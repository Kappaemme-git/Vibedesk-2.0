import { Composition } from "remotion";
import { Trailer } from "./trailer";

export const Root = () => {
  return (
    <>
      <Composition
        id="trailer"
        component={Trailer}
        durationInFrames={1200}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
