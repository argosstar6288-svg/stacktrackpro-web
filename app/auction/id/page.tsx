"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, runTransaction } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useCurrentUser } from "../../lib/useCurrentUser";
import Image from "next/image";
import styles from "./auction-detail.module.css";
import { sendAuctionMessage, subscribeToAuctionChat, ChatMessage } from "../../lib/auctionChat";
import { useTrackView, useTrackBid, useTrackPurchase } from "../../lib/useTrackInteractions";
import DashboardLayout from "../../dashboard/layout";

export default function AuctionDetail() {
  const { id } = useParams();
  const [auction, setAuction] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState("");
  const [myBid, setMyBid] = useState<string>("");
  const [myMaxBid, setMyMaxBid] = useState<string>("");
  const { user } = useCurrentUser();
  const [bidError, setBidError] = useState<string>("");
  const [bidLoading, setBidLoading] = useState(false);
  const viewTrackedRef = useRef(false);

  // Tracking hooks
  const trackView = useTrackView();
  const trackBid = useTrackBid();

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const purchaseTrackedRef = useRef(false);

  // Tracking hooks
  const trackPurchase = useTrackPurchase();

  async function handlePlaceBid(quick = false) {
    setBidError("");
    if (!user || !auction) return;
    const bidAmount = quick
      ? Number(auction.currentBid) + Number(auction.bidIncrement)
      : Number(myBid);
    if (isNaN(bidAmount) || bidAmount < Number(auction.currentBid) + Number(auction.bidIncrement)) {
      setBidError(`Bid must be at least $${(Number(auction.currentBid) + Number(auction.bidIncrement)).toFixed(2)}`);
      return;
    }
    setBidLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const auctionRef = doc(db, "auctions", auction.id);
        const auctionSnap = await transaction.get(auctionRef);
        if (!auctionSnap.exists()) throw new Error("Auction not found");
        const data = auctionSnap.data();
        if (data.highestBidderId === user.uid) throw new Error("You are already the highest bidder");
        if (data.createdBy === user.uid) throw new Error("Cannot bid on your own auction");
        if (Number(bidAmount) < Number(data.currentBid) + Number(data.bidIncrement)) throw new Error("Bid too low");
        if (data.endTime?.toDate && data.endTime.toDate() < new Date()) {
  throw new Error("Auction has ended");
}

if (data.status && data.status !== "active") {
  throw new Error("Auction is not active");
}

        // Add bid to subcollection
        const bidsCol = collection(auctionRef, "bids");
        transaction.set(doc(bidsCol), {
          amount: bidAmount,
          userId: user.uid,
          userName: user.displayName || user.email || "User",
          createdAt: serverTimestamp(),
        });
        // Update auction doc
        transaction.update(auctionRef, {
          currentBid: bidAmount,
          highestBidderId: user.uid,
        });
      });
      
      // 📊 Track bid
      await trackBid(
        auction.id,
        auction.cardName ?? "Item",
        auction.category ?? "Trading Cards",
        bidAmount,
        Number(auction.currentBid ?? 0)
      );
      
      setMyBid("");
      setMyMaxBid("");
    } catch (err: any) {
      setBidError(err.message || "Bid failed");
    } finally {
      setBidLoading(false);
    }
  }
  // 🟢 Real-time bids subcollection listener
  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, "auctions", id as string, "bids"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setBids(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [id]);

  // 🔴 Real-time auction listener
  useEffect(() => {
    if (!id) return;

    const unsub = onSnapshot(doc(db, "auctions", id as string), snap => {
      if (snap.exists()) {
        const data: any = snap.data();

        setAuction({
          id: snap.id,
          cardName: data.cardName ?? "",
          imageUrl: data.imageUrl ?? null,
          createdBy: data.createdBy ?? "",
          // normalize Firestore Timestamps to JS Dates when present
          startTime: data.startTime?.toDate ? data.startTime.toDate() : data.startTime ?? null,
          endTime: data.endTime?.toDate ? data.endTime.toDate() : data.endTime ?? null,
          currentBid: Number(data.currentBid ?? 0),
          bidIncrement: Number(data.bidIncrement ?? 0),
          highestBidderId: data.highestBidderId ?? null,
          // include any other fields
          ...data,
        });

        // 📊 Track view on first load
        if (!viewTrackedRef.current && user) {
          viewTrackedRef.current = true;
          trackView(
            snap.id,
            data.cardName ?? "Item",
            data.category ?? "Trading Cards",
            Number(data.currentBid ?? 0)
          );
        }
      }
    });

    return () => unsub();
  }, [id, user, trackView]);

  // 🔵 Countdown timer
  useEffect(() => {
    if (!auction?.endTime) return;

    const interval = setInterval(() => {
      const end = auction.endTime instanceof Date ? auction.endTime : new Date(auction.endTime);
      const now = new Date();
      const diff = end.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("Auction Ended");
        clearInterval(interval);
        
        // 📊 Track purchase if user is the winner
        if (!purchaseTrackedRef.current && user && auction.highestBidderId === user.uid) {
          purchaseTrackedRef.current = true;
          trackPurchase(
            auction.id,
            auction.cardName ?? "Item",
            auction.category ?? "Trading Cards",
            Number(auction.currentBid ?? 0)
          ).catch(err => console.error("Purchase tracking failed:", err));
        }
        
        return;
      }

      const hrs = Math.floor(diff / 1000 / 60 / 60);
      const mins = Math.floor((diff / 1000 / 60) % 60);
      const secs = Math.floor((diff / 1000) % 60);

      setTimeLeft(`${hrs} hrs : ${mins} min : ${secs} sec`);
    }, 1000);

    return () => clearInterval(interval);
  }, [auction, user, trackPurchase]);

  // Real-time chat subscription
  useEffect(() => {
    if (!auction?.id) return;
    const unsub = subscribeToAuctionChat(auction.id, setChatMessages);
    return () => unsub();
  }, [auction?.id]);

  async function handleSendChat(e: React.FormEvent) {
    e.preventDefault();
    setChatError("");
    if (!user) {
      setChatError("Login required");
      return;
    }
    if (!chatInput.trim()) return;
    try {
      await sendAuctionMessage(
        auction.id,
        user.uid,
        user.displayName || user.email || "User",
        chatInput.trim()
      );
      setChatInput("");
    } catch (err: any) {
      setChatError(err.message || "Failed to send message");
    }
  }

  if (!auction) return (
    <DashboardLayout>
      <div className={styles.loadingWrap}>
        <div className={styles.loadingText}>Loading auction...</div>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Live Auctions</p>
          <h1 className={styles.title}>Auction: {auction.cardName}</h1>
        </div>
      </div>

      <div className={styles.layoutGrid}>
        {/* LEFT SIDE - Card Image */}
        <div className={`panel ${styles.leftPanel}`}>
          <div className={styles.imageWrap}>
          {auction.imageUrl ? (
            <Image 
              src={auction.imageUrl} 
              alt={auction.cardName} 
              width={350} 
              height={490} 
              className={styles.cardImage}
            />
          ) : (
            <div className={styles.imagePlaceholder}>
              No Image
            </div>
          )}
          </div>

          <h2 className={styles.cardName}>
            {auction.cardName}
          </h2>
          <div className={styles.metaList}>
            <div>Start: {auction.startTime ? new Date(auction.startTime).toLocaleString() : "N/A"}</div>
            <div>End: {auction.endTime ? new Date(auction.endTime).toLocaleString() : "N/A"}</div>
            <div>Created By: {auction.createdBy ?? "N/A"}</div>
          </div>
        </div>

        {/* RIGHT SIDE - Bidding */}
        <div className={styles.rightColumn}>
          {/* Current Bid */}
          <div className={`panel ${styles.bidSummaryPanel}`}>
            <div className={styles.summaryLabel}>CURRENT BID</div>
            <h2 className={styles.currentBidValue}>
              ${Number(auction.currentBid ?? 0).toFixed(2)}
            </h2>
            {auction.highestBidderId && (
              <div className={styles.highestBidder}>
                Highest Bidder: {auction.highestBidderId === user?.uid ? "You!" : auction.highestBidderId}
              </div>
            )}
            <div className={styles.nextBid}>
              Next Bid: ${(Number(auction.currentBid ?? 0) + Number(auction.bidIncrement ?? 0)).toFixed(2)}
            </div>

            <input
              placeholder="Enter your bid amount..."
              value={myBid}
              onChange={e => setMyBid(e.target.value)}
              inputMode="numeric"
              className={styles.bidInput}
            />
            <input
              placeholder="Maximum bid (optional)..."
              value={myMaxBid}
              onChange={e => setMyMaxBid(e.target.value)}
              inputMode="numeric"
              className={styles.bidInput}
            />

          <div className={styles.actionRow}>
            <button 
              className={styles.primaryButton}
              disabled={!user || (user && auction?.createdBy && user.uid === auction.createdBy) || (user && auction?.highestBidderId && user.uid === auction.highestBidderId) || bidLoading}
              onClick={() => handlePlaceBid(true)}
            >
              {bidLoading ? "Bidding..." : "⚡ Quick Bid"}
            </button>
            <button 
              className={styles.secondaryButton}
              disabled={!user || (user && auction?.createdBy && user.uid === auction.createdBy) || (user && auction?.highestBidderId && user.uid === auction.highestBidderId) || bidLoading}
              onClick={() => handlePlaceBid(false)}
            >
              {bidLoading ? "Bidding..." : "💰 Place Bid"}
            </button>
          </div>
          {bidError && (
            <div className={styles.errorBox}>
              {bidError}
            </div>
          )}
          </div>

          {/* Countdown */}
          <div className={`panel ${styles.countdownPanel}`}>
            <div className={styles.summaryLabel}>TIME REMAINING</div>
            <div className={`${styles.timeValue} ${timeLeft === "Auction Ended" ? styles.timeEnded : ""}`}>
              {timeLeft}
            </div>
          </div>

          {/* Bid History */}
          <div className={`panel ${styles.historyPanel}`}>
            <h3 className={styles.sectionTitle}>📊 Bid History</h3>
            {bids.length === 0 ? (
              <div className={styles.emptyMini}>No bids yet. Be the first!</div>
            ) : (
              <div className={styles.scrollList}>
                {bids.map(bid => (
                  <div key={bid.id} className={styles.historyItem}>
                    <div>
                      <strong className={styles.historyAmount}>
                        ${Number(bid.amount).toFixed(2)}
                      </strong>
                      <div className={styles.historyUser}>
                        {bid.userName ?? bid.userId ?? "Unknown"}
                      </div>
                    </div>
                    <div className={styles.historyTime}>
                      {bid.createdAt?.toDate ? bid.createdAt.toDate().toLocaleTimeString() : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auction Chat */}
      <div className={`panel ${styles.chatPanel}`}>
        <h3 className={styles.sectionTitle}>💬 Auction Chat</h3>
        <div className={styles.chatMessages}>
          {chatMessages.length === 0 ? (
            <div className={styles.emptyMini}>
              No messages yet. Start the conversation!
            </div>
          ) : (
            chatMessages.map(msg => (
              <div key={msg.id} className={`${styles.chatMessage} ${msg.senderId === user?.uid ? styles.chatMine : ""}`}>
                <div className={styles.chatSender}>
                  {msg.senderName}
                </div>
                <div className={styles.chatText}>{msg.text}</div>
                <div className={styles.chatTime}>
                  {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString() : ''}
                </div>
              </div>
            ))
          )}
        </div>
        <form onSubmit={handleSendChat} className={styles.chatForm}>
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Type your message..."
            className={styles.chatInput}
            disabled={!user}
          />
          <button 
            type="submit" 
            className={styles.primaryButton}
            disabled={!user || !chatInput.trim()}
          >
            Send
          </button>
        </form>
        {chatError && (
          <div className={styles.chatError}>{chatError}</div>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}
