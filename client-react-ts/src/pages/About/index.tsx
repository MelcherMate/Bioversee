import InfoCard from "../../components/infoCard";
import Mate from "../../img/Mate.png";
import Logo from "../../utils/svgs/new_logo.svg";
import "./About.css";

function About() {
  return (
    <main className="container" id="aboutContainer">
      <InfoCard
        title="Founder"
        imagePath={Mate}
        subtitle="Mate Melcher"
        content="Biochemical engineer aiming to make industrial bioprocess automation as easy as child's play"
      />
      <InfoCard
        title="Company"
        imagePath={Logo}
        subtitle="Bioversee"
        content="Bioversee aims to create an affordable and playful solution for industrial automation as well as becoming a proper educational software for engineering students"
        imageContain
      />
    </main>
  );
}

export default About;
