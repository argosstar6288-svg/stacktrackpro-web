const auctions = [
  { item: "Jordan 1986 Fleer", bids: 18, price: "$9,420" },
  { item: "Mantle 1952 Topps", bids: 31, price: "$52,300" },
  { item: "Curry 2009 Chrome", bids: 11, price: "$3,780" },
];

export default function AuctionsPanel() {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Live Auctions</h2>
          <p className="panel-subtitle">Bidding velocity right now</p>
        </div>
        <button className="panel-button" type="button">
          Join Auction
        </button>
      </div>
      <div className="auction-list">
        {auctions.map((auction) => (
          <div key={auction.item} className="auction-row">
            <div>
              <p className="auction-item">{auction.item}</p>
              <p className="auction-bids">{auction.bids} bids</p>
            </div>
            <span className="auction-price">{auction.price}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
