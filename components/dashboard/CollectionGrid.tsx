interface FolderPreview {
  id: string;
  name: string;
  count: number;
}

interface CardPreview {
  id: string;
  name: string;
}

interface CollectionGridProps {
  folders: FolderPreview[];
  cards: CardPreview[];
  loading?: boolean;
}

export default function CollectionGrid({ folders, cards, loading }: CollectionGridProps) {
  return (
    <section className="dashboard-card" id="collection-section">
      <div className="section-head">
        <h2>My Collection</h2>
      </div>

      <div className="collection-layout">
        <aside className="collection-folders">
          {loading ? (
            <p className="scan-set">Loading folders...</p>
          ) : folders.length === 0 ? (
            <p className="scan-set">No folders yet.</p>
          ) : (
            folders.map((folder) => (
              <button key={folder.id} className="folder-chip">
                {folder.name} ({folder.count})
              </button>
            ))
          )}
        </aside>

        {loading ? (
          <p className="scan-set">Loading cards...</p>
        ) : cards.length === 0 ? (
          <p className="scan-set">No cards in your collection yet.</p>
        ) : (
          <div className="collection-grid">
            {cards.map((card) => (
              <article key={card.id} className="collection-card">
                <div className="collection-card-image">🃏</div>
                <p>{card.name}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
