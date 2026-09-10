import React from "react";
import "./InfoCard.css";

interface InfoCardProps {
  title: string;
  subtitle: string;
  content: string;
  imagePath: string;
  imageContain?: boolean;
}

const InfoCard: React.FC<InfoCardProps> = ({
  title,
  subtitle,
  content,
  imagePath,
  imageContain = false,
}) => {
  return (
    <div className="infoCard">
      <h1 id="title">{title}</h1>
      <div id="imageContainer">
        <img
          src={imagePath}
          alt={title}
          id="image"
          className={imageContain ? "infoCard__image--contain" : undefined}
        />
      </div>
      <h2 id="subtitle">{subtitle}</h2>
      <p id="text">{content}</p>
    </div>
  );
};

export default InfoCard;
