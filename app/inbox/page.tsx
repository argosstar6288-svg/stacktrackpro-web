"use client";

import AppShell from "@/components/AppShell";
import InboxRow from "@/components/InboxRow";

export default function InboxPage() {
  return (
    <AppShell>
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom right, rgba(124, 45, 18, 0.2), rgba(15, 23, 42, 1), rgba(30, 58, 138, 0.3))",
        padding: "1rem",
        borderRadius: 20
      }}>
      <h1 className="page-title">✉️ Inbox</h1>
      
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: 30 
      }}>
        <p style={{ fontSize: "1.1rem", opacity: 0.9 }}>
          3 unread messages
        </p>
        <button className="primary-btn">
          ✏️ Compose
        </button>
      </div>

      <div>
        <InboxRow 
          name="Sarah Martinez" 
          message="Hey! Is that Charizard card still available?" 
          time="2m ago"
          unread={true}
        />
        <InboxRow 
          name="Mike Thompson" 
          message="Thanks for the quick shipping! Card arrived perfect." 
          time="1h ago"
          unread={true}
        />
        <InboxRow 
          name="Alex Chen" 
          message="Would you accept $450 for the PSA 9 Pikachu?" 
          time="3h ago"
          unread={true}
        />
        <InboxRow 
          name="StackTrack Team" 
          message="Your auction for 'Blastoise Base Set' has ended!" 
          time="5h ago"
        />
        <InboxRow 
          name="Jordan Lee" 
          message="I'm interested in your Magic collection. Can we trade?" 
          time="Yesterday"
        />
        <InboxRow 
          name="Taylor Swift Fan" 
          message="Do you have any Taylor Swift concert memorabilia?" 
          time="2 days ago"
        />
        <InboxRow 
          name="StackTrack Team" 
          message="New feature: Price tracking now available!" 
          time="3 days ago"
        />
      </div>
      </div>
    </AppShell>
  );
}
