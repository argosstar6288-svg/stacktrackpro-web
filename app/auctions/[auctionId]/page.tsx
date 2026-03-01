'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { 
  doc, 
  onSnapshot, 
  runTransaction, 
  Timestamp, 
  collection,
  query,
  orderBy,
  increment,
  serverTimestamp 
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useCurrentUser } from '@/lib/useCurrentUser'
import styles from './auction.module.css'

interface Auction {
  id: string
  cardName: string
  imageUrl: string
  set: string
  year: number
  condition: string
  gradingCompany?: string
  currentBid: number
  minimumNextBid: number
  bidCount: number
  sellerId: string
  sellerName: string
  highestBidderId?: string | null
  highestBidder?: string | null
  endTime: Timestamp
  ended?: boolean
  status?: 'active' | 'ended'
}

interface BidHistory {
  userId: string
  amount: number
  timestamp?: Timestamp
  userName?: string
}

export default function AuctionDetailPage() {
  const params = useParams()
  const auctionId = params.auctionId as string
  const { user } = useCurrentUser()
  
  const [auction, setAuction] = useState<Auction | null>(null)
  const [bidHistory, setBidHistory] = useState<BidHistory[]>([])
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({ hours: 0, minutes: 0, seconds: 0 })
  const [isFlipped, setIsFlipped] = useState(false)
  const [maxBid, setMaxBid] = useState('')
  const [isHighestBidder, setIsHighestBidder] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [bidError, setBidError] = useState('')

  // Real-time auction listener
  useEffect(() => {
    if (!auctionId) return

    const unsubscribe = onSnapshot(
      doc(db, 'auctions', auctionId),
      (docSnap) => {
        if (docSnap.exists()) {
          setAuction({ id: docSnap.id, ...docSnap.data() } as Auction)
        }
      },
      (error) => {
        setError('Failed to load auction')
        console.error(error)
      }
    )

    return () => unsubscribe()
  }, [auctionId])

  // Real-time bid history listener
  useEffect(() => {
    if (!auctionId) return

    const unsubscribe = onSnapshot(
      query(collection(db, 'auctions', auctionId, 'bids'), orderBy('timestamp', 'desc')),
      (querySnap) => {
        const bids: BidHistory[] = []
        querySnap.forEach((doc) => {
          bids.push({ ...doc.data() } as BidHistory)
        })
        setBidHistory(bids)
      },
      (error) => {
        console.error('Failed to load bid history:', error)
      }
    )

    return () => unsubscribe()
  }, [auctionId])

  // Countdown timer logic - server-time based
  useEffect(() => {
    if (!auction?.endTime) return

    const interval = setInterval(() => {
      const now = Date.now()
      const endTimeMs = auction.endTime.toMillis()
      const distance = endTimeMs - now

      if (distance <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 })
      } else {
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((distance % (1000 * 60)) / 1000)

        setTimeLeft({ hours, minutes, seconds })
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [auction?.endTime])

  const formatTime = (num: number) => String(num).padStart(2, '0')
  const isTimeWarning = timeLeft.hours === 0 && timeLeft.minutes < 5
  const auctionEnded = Boolean(auction?.ended) || auction?.status === 'ended' || (auction?.endTime ? auction.endTime.toMillis() <= Date.now() : false)
  const canBid = user && auction && !auctionEnded && auction.sellerId !== user.uid && Number.isFinite(parseFloat(maxBid)) && parseFloat(maxBid) > auction.currentBid
  
  const handlePlaceAutoBid = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      setError('Please log in to place a bid')
      return
    }

    if (!auction) {
      setError('Auction not found')
      return
    }

    const bidAmount = parseFloat(maxBid)

    if (bidAmount <= auction.currentBid) {
      setBidError(`Bid must be at least $${(auction.currentBid + 1).toFixed(2)}`)
      return
    }

    setLoading(true)
    setBidError('')
    setError('')

    try {
      await runTransaction(db, async (transaction) => {
        const auctionRef = doc(db, 'auctions', auctionId)
        const auctionDoc = await transaction.get(auctionRef)

        if (!auctionDoc.exists()) {
          throw new Error('Auction not found')
        }

        const currentData = auctionDoc.data() as Auction
        const now = Date.now()
        const remainingTime = currentData.endTime.toMillis() - now

        // Validate bid is still higher than current
        if (bidAmount <= currentData.currentBid) {
          throw new Error('You have been outbid. Please place a higher bid.')
        }

        // Prevent bidding after auction ended
        if (currentData.ended || currentData.status === 'ended' || remainingTime <= 0) {
          throw new Error('Auction has ended')
        }

        // Anti-sniping: Extend auction by 30 seconds if bid within final 10 seconds
        if (remainingTime < 10000) {
          transaction.update(auctionRef, {
            endTime: Timestamp.fromMillis(now + 30000)
          })
        }

        // Update auction with new bid
        transaction.update(auctionRef, {
          currentBid: bidAmount,
          minimumNextBid: bidAmount + 5,
          highestBidderId: user.uid,
          highestBidder: user.uid,
          bidCount: increment(1),
          lastBidTime: serverTimestamp()
        })

        // Record bid in subcollection
        const bidRef = doc(collection(db, 'auctions', auctionId, 'bids'))
        transaction.set(bidRef, {
          userId: user.uid,
          amount: bidAmount,
          timestamp: serverTimestamp(),
          userName: user.displayName || 'Anonymous'
        })
      })

      setSuccess(true)
      setMaxBid('')
      setIsHighestBidder(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setBidError(err.message || 'Failed to place bid')
      console.error('Bid error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getTimeAgo = (timestamp?: Timestamp) => {
    if (!timestamp) {
      return 'just now'
    }
    const diff = Date.now() - timestamp.toMillis()
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    
    if (minutes > 0) return `${minutes}m ago`
    return `${seconds}s ago`
  }

  if (!auction && !error) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingMessage}>
          <div className={styles.spinner}></div>
          Loading auction...
        </div>
      </div>
    )
  }

  if (error && !auction) {
    return (
      <div className={styles.container}>
        <div className={styles.errorBanner}>{error}</div>
      </div>
    )
  }

  if (!auction) {
    return (
      <div className={styles.container}>
        <div className={styles.errorBanner}>Auction not found</div>
      </div>
    )
  }


  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Link href="/auctions/live" className={styles.backButton}>
          ← Back to Live Auctions
        </Link>
        <h1>Live Auction</h1>
        <div className={styles.spacer}></div>
      </div>

      <div className={styles.mainContent}>
        {/* TOP SECTION */}
        <div className={styles.topSection}>
          {/* Left: Card Image */}
          <div className={styles.cardImageContainer}>
            <button 
              className={styles.flipButton}
              onClick={() => setIsFlipped(!isFlipped)}
              title="Flip card"
            >
              ⤴️
            </button>
            <div className={`${styles.cardImage} ${isFlipped ? styles.flipped : ''}`}>
              <img 
                src={auction.imageUrl || '/placeholder-card.png'} 
                alt={auction.cardName}
              />
            </div>
          </div>

          {/* Right: Card Details */}
          <div className={styles.cardDetails}>
            <h2>{auction.cardName}</h2>
            
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <span className={styles.label}>Set</span>
                <span className={styles.value}>{auction.set}</span>
              </div>
              
              <div className={styles.detailItem}>
                <span className={styles.label}>Year</span>
                <span className={styles.value}>{auction.year}</span>
              </div>
              
              <div className={styles.detailItem}>
                <span className={styles.label}>Condition</span>
                <span className={`${styles.value} ${styles.badge}`}>{auction.condition}</span>
              </div>
              
              {auction.gradingCompany && (
                <div className={styles.detailItem}>
                  <span className={styles.label}>Grade</span>
                  <span className={`${styles.value} ${styles.badgeOrange}`}>{auction.gradingCompany}</span>
                </div>
              )}
              
              <div className={styles.detailItem}>
                <span className={styles.label}>Seller</span>
                <span className={styles.value}>{auction.sellerName}</span>
              </div>
              
              <div className={styles.detailItem}>
                <span className={styles.label}>Auction ID</span>
                <span className={styles.value} style={{fontSize: '0.875rem'}}>{auction.id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Auction Status Banners */}
        {auctionEnded && (
          <div className={styles.endedBanner}>
            🔚 This auction has ended
          </div>
        )}
        
        {error && (
          <div className={styles.errorBanner}>{error}</div>
        )}

        {/* CURRENT BID SECTION */}
        <div className={styles.bidSection}>
          <div className={styles.bidCard}>
            <div className={styles.bigBid}>
              <div className={styles.bidAmount}>
                <span className={styles.label}>Current Bid</span>
                <span className={styles.amount}>${auction.currentBid.toFixed(2)}</span>
              </div>
              
              <div className={styles.bidAmount}>
                <span className={styles.label}>Minimum Next Bid</span>
                <span className={styles.amount}>${auction.minimumNextBid.toFixed(2)}</span>
              </div>
              
              <div className={styles.bidAmount}>
                <span className={styles.label}>Total Bids</span>
                <span className={styles.amount}>{auction.bidCount}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.contentGrid}>
          {/* Left Column: Countdown & Auto Bid */}
          <div className={styles.leftColumn}>
            {/* COUNTDOWN TIMER */}
            <div className={`${styles.countdownCard} ${isTimeWarning ? styles.warning : ''}`}>
              <div className={styles.countdownLabel}>⏳ Time Remaining</div>
              <div className={styles.countdownDisplay}>
                {formatTime(timeLeft.hours)} : {formatTime(timeLeft.minutes)} : {formatTime(timeLeft.seconds)}
              </div>
              {isTimeWarning && <div className={styles.warningText}>⚠️ Less than 5 minutes!</div>}
            </div>

            {/* AUTO BID SECTION */}
            <div className={styles.autoBidCard}>
              <h3>🤖 Auto Bid Controls</h3>
              
              {!user ? (
                <div className={styles.loginPrompt}>
                  Please <Link href="/auth/login">log in</Link> to place a bid
                </div>
              ) : (
                <form onSubmit={handlePlaceAutoBid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="maxBid">Your Maximum Bid</label>
                    <div className={styles.inputWrapper}>
                      <span className={styles.currencySymbol}>$</span>
                      <input
                        id="maxBid"
                        type="number"
                        step="5"
                        min={auction.minimumNextBid}
                        placeholder="Enter max bid"
                        value={maxBid}
                        onChange={(e) => setMaxBid(e.target.value)}
                        disabled={loading || auctionEnded}
                      />
                    </div>
                    {bidError && <div className={styles.inputError}>{bidError}</div>}
                  </div>

                  <button 
                    type="submit" 
                    className={styles.placeBidButton}
                    disabled={!canBid || loading}
                  >
                    {loading ? 'Placing Bid...' : 'Place Auto Bid'}
                  </button>
                </form>
              )}

              {/* Auto Bid Status */}
              {isHighestBidder && user && auction.highestBidderId === user.uid && (
                <div className={styles.biddingStatus}>
                  <div className={styles.statusGreen}>
                    ✓ You are currently the highest bidder
                  </div>
                  <div className={styles.statusDetails}>
                    Your maximum bid: <strong>${maxBid || auction.currentBid.toFixed(2)}</strong>
                  </div>
                </div>
              )}

              {user && auction.highestBidderId && auction.highestBidderId !== user.uid && maxBid && (
                <div className={styles.biddingStatus}>
                  <div className={styles.statusRed}>
                    ✗ You have been outbid
                  </div>
                  <div className={styles.statusDetails}>
                    Current bid: <strong>${auction.currentBid.toFixed(2)}</strong>
                  </div>
                </div>
              )}

              {success && (
                <div className={styles.successBanner}>
                  ✓ Auto bid placed! You're bidding up to ${maxBid}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Bid History */}
          <div className={styles.rightColumn}>
            <div className={styles.bidHistoryCard}>
              <h3>📜 Bid History</h3>
              
              {bidHistory.length === 0 ? (
                <div className={styles.noBidsMessage}>No bids yet</div>
              ) : (
                <div className={styles.bidHistoryList}>
                  {bidHistory.map((bid, index) => (
                    <div key={index} className={styles.bidHistoryItem}>
                      <div className={styles.bidHistoryLeft}>
                        <div className={styles.bidUser}>{bid.userName || 'Anonymous'}</div>
                        <div className={styles.bidTime}>{getTimeAgo(bid.timestamp)}</div>
                      </div>
                      <div className={styles.bidHistoryRight}>
                        <div className={styles.bidAmount}>${bid.amount.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
