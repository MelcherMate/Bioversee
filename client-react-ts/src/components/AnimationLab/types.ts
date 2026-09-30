export type AnimationPreviewId =
  | "auth-verify"
  | "auth-verify-replay"
  | "auth-form";

export type AnimationLabSection = {
  id: string;
  title: string;
  items: {
    id: AnimationPreviewId;
    label: string;
    hint: string;
  }[];
};
