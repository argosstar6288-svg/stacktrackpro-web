"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type FeatureCardProps = {
  title: string;
  desc: string;
  onClick: () => void;
};

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Hot");
  const goToAuth = () => router.push("/signup");

  const cards = [
    { id: 1, name: "Pikachu", price: 35.3, trend: "+98%" },
    { id: 2, name: "Michael Jordan", price: 80, trend: "-9.5%" },
    { id: 3, name: "Charizard", price: 44.19, trend: "+3.57%" },
    { id: 4, name: "Dark Magician", price: 84, trend: "+76%" },
  ];

  return (
    <div className="min-h-screen bg-[#05070d] px-6 py-10 text-white md:px-10 lg:px-16">
      <section className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-10 md:flex-row">
        <div>
          <h1 className="text-5xl font-bold leading-tight">
            Track. Scan. <span className="text-orange-500">Trade.</span>
          </h1>
          <p className="mt-4 max-w-md text-gray-400">
            The modern platform for managing and selling trading cards.
          </p>

          <button
            onClick={goToAuth}
            className="mt-6 rounded-xl bg-orange-500 px-6 py-3 font-semibold transition hover:bg-orange-600"
            type="button"
          >
            Start Collecting
          </button>
        </div>

        <div className="rounded-2xl bg-[#0c1220] p-6 shadow-lg shadow-black/30">
          <div className="flex h-96 w-60 items-center justify-center rounded-xl bg-black text-center text-lg text-gray-300">
            📱 Card Scanner UI
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-7xl gap-6 md:grid-cols-3">
        <FeatureCard
          title="Scan Cards"
          desc="Instantly add cards with your camera"
          onClick={goToAuth}
        />
        <FeatureCard
          title="Track Value"
          desc="Real-time portfolio analytics"
          onClick={goToAuth}
        />
        <FeatureCard
          title="Buy & Sell"
          desc="Marketplace for trading cards"
          onClick={goToAuth}
        />
      </section>

      <section className="mx-auto mt-20 max-w-7xl">
        <h2 className="text-center text-3xl font-bold">Live Marketplace</h2>

        <div className="mt-6 flex flex-wrap justify-center gap-4">
          {["Hot", "Pokémon", "Sports", "Magic"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-2 transition ${
                activeTab === tab ? "bg-orange-500" : "bg-[#111827] hover:bg-[#182132]"
              }`}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.id}
              className="rounded-xl bg-[#0c1220] p-4 shadow transition hover:scale-[1.02] hover:shadow-lg hover:shadow-black/30"
            >
              <button
                onClick={goToAuth}
                className="mb-4 flex h-40 w-full items-center justify-center rounded bg-black text-5xl transition hover:scale-105"
                type="button"
              >
                🃏
              </button>

              <h3 className="font-bold">{card.name}</h3>
              <p className="text-gray-400">${card.price}</p>
              <p className={card.trend.includes("+") ? "text-green-400" : "text-red-400"}>
                {card.trend}
              </p>

              <button
                onClick={goToAuth}
                className="mt-3 w-full rounded-lg bg-orange-500 py-2 font-semibold transition hover:bg-orange-600"
                type="button"
              >
                Buy Now
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ title, desc, onClick }: FeatureCardProps) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl bg-[#0c1220] p-6 text-left transition hover:scale-[1.02] hover:bg-[#111827]"
      type="button"
    >
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="mt-2 text-gray-400">{desc}</p>
    </button>
  );
}
