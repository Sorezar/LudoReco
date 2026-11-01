import Image from "next/image";

// Game box on a blurred copy of itself, or the first letter of the name when BGG has no picture
export default function GameImage({
  src,
  backdrop,
  name,
  sizes,
  className = "aspect-[4/3]",
}: {
  src: string | null;
  backdrop?: string | null; // smaller picture for the blurred background
  name: string;
  sizes: string;
  className?: string;
}) {
  const background = backdrop ?? src;
  return (
    <div className={`relative w-full overflow-hidden bg-accent-soft ${className}`}>
      {background && <Image src={background} alt="" aria-hidden fill sizes="200px" className="scale-125 object-cover opacity-50 blur-2xl" />}
      {src ? (
        <Image src={src} alt={name} fill sizes={sizes} className="object-contain p-3 drop-shadow-[0_10px_18px_rgba(0,0,0,0.25)]" />
      ) : (
        <span className="absolute inset-0 grid place-items-center font-display text-5xl font-semibold text-accent">{name[0]}</span>
      )}
    </div>
  );
}
