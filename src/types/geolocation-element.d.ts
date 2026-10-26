import type { DetailedHTMLProps, HTMLAttributes } from "react";

type GeolocationElementProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  autolocate?: boolean;
  accuracymode?: "approximate" | "precise";
  watch?: boolean;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      geolocation: GeolocationElementProps;
    }
  }
}
