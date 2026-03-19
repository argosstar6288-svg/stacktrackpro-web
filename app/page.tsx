import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#050912] flex justify-center">
      <div className="relative w-full max-w-[768px]">
        <Image
          src="/homepage-hero-v2.png"
          alt="StackTrack homepage"
          width={768}
          height={1792}
          priority
          className="w-full h-auto block"
        />

        <Link
          href="/create-account"
          aria-label="Start Collecting"
          className="absolute left-[7.5%] top-[9.6%] h-[2.6%] w-[11%] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ff8f00] focus:ring-offset-2 focus:ring-offset-transparent"
        />

        <Link
          href="/login"
          aria-label="Login"
          className="absolute top-0 right-0 h-[6%] w-[22%] rounded-md focus:outline-none focus:ring-2 focus:ring-[#ff8f00] focus:ring-offset-2 focus:ring-offset-transparent"
        />
      </div>
    </main>
  );
}
