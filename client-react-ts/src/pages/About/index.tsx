import InfoCard from "../../components/infoCard";
import Mate from "../../img/Mate.png";
import Logo from "../../img/new_logo.png";

import "../../img/new_logo.png";
import "./About.css";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function About(props: any) {
  return (
    <main className="container" id="aboutContainer">
      <InfoCard
        title="Founder"
        imagePath={Mate}
        subtitle="Mate Melcher"
        content="Biochemical engineer aiming to make industrial bioprocess automation as easy as child's play"
      />
      {/* <InfoCard
        title="Co-Founder"
        imagePath="../../img/David.png"
        subtitle="David Kutas"
        content="An amazing front-end developer from Silicon Valley, Mate's friend since he was born"
      /> */}
      <InfoCard
        title="Company"
        imagePath={Logo}
        subtitle=""
        content="Bioversee aims to create an affordable and playful solution for industrial automation as well as becoming a proper educational software for engineering students"
      />
    </main>
  );
}

export default About;
