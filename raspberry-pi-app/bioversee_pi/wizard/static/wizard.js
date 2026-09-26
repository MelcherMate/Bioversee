const state = {
  step: "project",
  pins: [],
  catalog: [],
  pollTimer: null,
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.detail || data.error || res.statusText;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

function showBanner(message) {
  const el = document.getElementById("banner");
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

function setStep(step) {
  state.step = step;
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.hidden = panel.id !== `step-${step}`;
  });
  document.querySelectorAll("#steps li").forEach((li) => {
    const s = li.dataset.step;
    li.classList.toggle("is-active", s === step);
    const order = ["project", "account", "device", "wiring", "done"];
    li.classList.toggle("is-done", order.indexOf(s) < order.indexOf(step));
  });
  if (step === "wiring") startWiringPoll();
  else stopWiringPoll();
}

async function bootstrap() {
  const status = await api("/api/status");
  if (status.version_display) {
    document.getElementById("app-version").textContent = status.version_display;
  }
  refreshUpdateStatus().catch(() => {});
  if (status.supabase_url) {
    document.getElementById("supabase-url").value = status.supabase_url;
  }
  if (status.has_project) {
    document.querySelector('#steps li[data-step="project"]')?.remove();
  }
  if (!status.has_project) {
    setStep("project");
    return;
  }
  if (!status.signed_in) {
    setStep("account");
    return;
  }
  if (!status.local?.device_id || !status.local?.has_api_key) {
    setStep("device");
    await loadDevices();
    return;
  }
  setStep("wiring");
  await loadHeader();
  if (status.simulate_gpio) {
    document.getElementById("sim-row").hidden = false;
  }
}

async function refreshUpdateStatus() {
  const box = document.getElementById("update-box");
  const label = document.getElementById("update-label");
  const applyBtn = document.getElementById("apply-update");
  label.textContent = "Checking updates…";
  applyBtn.hidden = true;
  box.classList.remove("is-available");
  try {
    const data = await api("/api/update/status");
    if (data.current_display) {
      document.getElementById("app-version").textContent = data.current_display;
    }
    if (!data.ok) {
      label.textContent = `${data.current_display || "v?"} · update check failed`;
      return;
    }
    if (data.update_available) {
      label.textContent = `${data.current_display} → ${data.remote_display} available`;
      applyBtn.hidden = false;
      box.classList.add("is-available");
    } else {
      label.textContent = `${data.current_display} · up to date`;
    }
  } catch (err) {
    label.textContent = "Could not check for updates";
  }
}

document.getElementById("check-update").addEventListener("click", () => {
  showBanner("");
  refreshUpdateStatus().catch((err) => showBanner(err.message));
});

document.getElementById("apply-update").addEventListener("click", async () => {
  showBanner("");
  const applyBtn = document.getElementById("apply-update");
  const label = document.getElementById("update-label");
  applyBtn.disabled = true;
  label.textContent = "Updating… this may take a minute";
  try {
    const data = await api("/api/update/apply", {
      method: "POST",
      body: "{}",
    });
    label.textContent = data.message || "Updated";
    applyBtn.hidden = true;
    if (data.current_display) {
      document.getElementById("app-version").textContent = data.current_display;
    }
    setTimeout(() => window.location.reload(), 2500);
  } catch (err) {
    showBanner(
      err.message +
        " — if permissions failed, run: sudo bioversee-update apply"
    );
    applyBtn.disabled = false;
    refreshUpdateStatus().catch(() => {});
  }
});

document.getElementById("save-project").addEventListener("click", async () => {
  showBanner("");
  try {
    await api("/api/project", {
      method: "POST",
      body: JSON.stringify({
        supabase_url: document.getElementById("supabase-url").value.trim(),
        supabase_anon_key: document.getElementById("supabase-key").value.trim(),
      }),
    });
    setStep("account");
  } catch (err) {
    showBanner(err.message);
  }
});

document.getElementById("login").addEventListener("click", async () => {
  showBanner("");
  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value,
      }),
    });
    setStep("device");
    await loadDevices();
  } catch (err) {
    showBanner(err.message);
  }
});

document.getElementById("signup").addEventListener("click", async () => {
  showBanner("");
  try {
    const data = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value,
      }),
    });
    if (data.needs_confirmation) {
      showBanner("Check your email to confirm, then sign in.");
      return;
    }
    setStep("device");
    await loadDevices();
  } catch (err) {
    showBanner(err.message);
  }
});

document.getElementById("refresh-devices").addEventListener("click", () => {
  loadDevices().catch((err) => showBanner(err.message));
});

async function loadDevices() {
  showBanner("");
  const data = await api("/api/devices");
  const root = document.getElementById("device-list");
  root.innerHTML = "";
  if (!data.devices?.length) {
    root.innerHTML =
      "<p class='lede'>No operable devices yet. Create one in the Bioversee web app, then refresh.</p>";
    return;
  }
  for (const device of data.devices) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "device-card";
    btn.innerHTML = `<strong>${escapeHtml(device.name)}</strong><span>${escapeHtml(
      device.type
    )} · ${escapeHtml(device.role)}</span>`;
    btn.addEventListener("click", async () => {
      showBanner("");
      try {
        await api("/api/devices/select", {
          method: "POST",
          body: JSON.stringify({
            device_id: device.id,
            device_name: device.name,
            device_type: device.type,
          }),
        });
        setStep("wiring");
        await loadHeader();
        const status = await api("/api/status");
        document.getElementById("sim-row").hidden = !status.simulate_gpio;
      } catch (err) {
        showBanner(err.message);
      }
    });
    root.appendChild(btn);
  }
}

async function loadHeader() {
  const data = await api("/api/gpio/header");
  state.pins = data.pins || [];
  state.catalog = data.catalog || [];
  renderHeader([], []);
  const select = document.getElementById("manual-peripheral");
  select.innerHTML = state.catalog
    .map((p) => `<option value="${p.id}">${escapeHtml(p.label)}</option>`)
    .join("");
}

function renderHeader(activePhysical, confirmedPhysical) {
  const board = document.getElementById("header-board");
  board.innerHTML = "";
  const byRow = {};
  for (const pin of state.pins) {
    byRow[pin.row] ??= [];
    byRow[pin.row][pin.col] = pin;
  }
  const rows = Object.keys(byRow)
    .map(Number)
    .sort((a, b) => a - b);
  for (const row of rows) {
    for (const col of [0, 1]) {
      const pin = byRow[row][col];
      if (!pin) continue;
      const el = document.createElement("div");
      el.className = "pin";
      el.dataset.col = String(col);
      el.dataset.physical = String(pin.physical);
      if (pin.kind === "5v" || pin.kind === "3v3") el.classList.add("is-power");
      if (pin.kind === "3v3") el.classList.add("is-3v3");
      if (pin.kind === "gnd") el.classList.add("is-gnd");
      if (activePhysical.includes(pin.physical)) el.classList.add("is-active");
      if (confirmedPhysical.includes(pin.physical)) el.classList.add("is-confirmed");
      el.innerHTML = `<span class="pin-dot"></span><span>${pin.physical} ${escapeHtml(
        pin.label
      )}</span>`;
      board.appendChild(el);
    }
  }
}

function startWiringPoll() {
  stopWiringPoll();
  const tick = async () => {
    try {
      const data = await api("/api/gpio/state");
      renderHeader(data.active_physical || [], data.confirmed_physical || []);
      renderGuesses(data.pending || []);
      renderConfirmed(data.confirmed || []);
      document.getElementById("finish").disabled = !(data.confirmed || []).length;
    } catch (err) {
      showBanner(err.message);
    }
  };
  tick();
  state.pollTimer = setInterval(tick, 1500);
}

function stopWiringPoll() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

function renderGuesses(pending) {
  const root = document.getElementById("guess-list");
  root.innerHTML = "";
  if (!pending.length) {
    root.innerHTML = "<p class='lede'>Waiting for a connection…</p>";
    return;
  }
  for (const guess of pending) {
    const card = document.createElement("div");
    card.className = "guess-card";
    const options = state.catalog
      .map(
        (p) =>
          `<option value="${p.id}" ${p.id === guess.id ? "selected" : ""}>${escapeHtml(
            p.label
          )}</option>`
      )
      .join("");
    card.innerHTML = `
      <strong>Is this a ${escapeHtml(guess.label)}?</strong>
      <p>${escapeHtml(guess.detail)} · confidence ${Math.round(
      (guess.confidence || 0) * 100
    )}%</p>
      <label>Change type
        <select data-role="type">${options}</select>
      </label>
      <div class="row">
        <button type="button" class="btn" data-role="confirm">Yes, confirm</button>
        <button type="button" class="btn btn-ghost" data-role="ignore">Ignore</button>
      </div>
    `;
    card.querySelector('[data-role="confirm"]').addEventListener("click", async () => {
      const peripheral_id = card.querySelector('[data-role="type"]').value;
      try {
        await api("/api/gpio/confirm", {
          method: "POST",
          body: JSON.stringify({ event_id: guess.event_id, peripheral_id }),
        });
      } catch (err) {
        showBanner(err.message);
      }
    });
    card.querySelector('[data-role="ignore"]').addEventListener("click", async () => {
      try {
        await api("/api/gpio/ignore", {
          method: "POST",
          body: JSON.stringify({ event_id: guess.event_id }),
        });
      } catch (err) {
        showBanner(err.message);
      }
    });
    root.appendChild(card);
  }
}

function renderConfirmed(items) {
  const root = document.getElementById("confirmed-list");
  root.innerHTML = items
    .map(
      (w) =>
        `<li><strong>${escapeHtml(w.name)}</strong> · ${escapeHtml(
          w.driver
        )} · BCM ${w.bcm ?? "—"} · pins ${(w.physical || []).join(", ")}</li>`
    )
    .join("");
}

document.querySelectorAll("[data-sim]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      await api("/api/gpio/simulate", {
        method: "POST",
        body: JSON.stringify({ peripheral_id: btn.dataset.sim }),
      });
    } catch (err) {
      showBanner(err.message);
    }
  });
});

document.getElementById("manual-add").addEventListener("click", async () => {
  try {
    await api("/api/gpio/manual", {
      method: "POST",
      body: JSON.stringify({
        peripheral_id: document.getElementById("manual-peripheral").value,
      }),
    });
  } catch (err) {
    showBanner(err.message);
  }
});

document.getElementById("finish").addEventListener("click", async () => {
  showBanner("");
  try {
    const data = await api("/api/finish", { method: "POST", body: "{}" });
    setStep("done");
    document.getElementById("done-message").textContent = data.agent?.enabled
      ? "Monitoring will start automatically when this Pi boots."
      : data.agent?.message || "Setup saved. Enable the agent service manually.";
    document.getElementById("done-detail").textContent = JSON.stringify(
      {
        config_path: data.config_path,
        agent: data.agent,
        cloud_error: data.cloud_error,
      },
      null,
      2
    );
  } catch (err) {
    showBanner(err.message);
  }
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

bootstrap().catch((err) => showBanner(err.message));
