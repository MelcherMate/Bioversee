import { Link } from "react-router-dom";
import "./EmptyDeviceState.css";

type EmptyDeviceStateProps = {
  processLabel: string;
};

function EmptyDeviceState({ processLabel }: EmptyDeviceStateProps) {
  return (
    <div className="empty-device">
      <div className="empty-device__card">
        <p className="empty-device__eyebrow">No device yet</p>
        <h1 className="empty-device__title">Add a {processLabel}</h1>
        <p className="empty-device__body">
          Devices aren’t created automatically. Use the <strong>+</strong> button
          next to Bioversee to add one, or accept a share invite from
          Notifications.
        </p>
        <Link className="empty-device__hint" to="/bioreactor">
          Stay here after you create one — pick it from the header icons.
        </Link>
      </div>
    </div>
  );
}

export default EmptyDeviceState;
