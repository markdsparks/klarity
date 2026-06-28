// Type declarations for CSS/CSS module imports used by Expo web builds.
declare module '*.css' {
  const styles: { [className: string]: string };
  export default styles;
}
