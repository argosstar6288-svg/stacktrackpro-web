'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  doc,
  getDoc 
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useCurrentUser } from '@/lib/useCurrentUser'
import styles from './live.module.css'

interface LiveAuction {
  id: string
  cardName: string
  imageUrl: string
  currentBid: number
  bidCount: number
  endTime: Timestamp
}

interface AuctionDisplay {
  id: string
  cardName: string
  imageUrl: string
  currentBid: number
  bidCount: number
  timeLeft: string
  endTime: Timestamp
}

export default function LiveAuctionsPage() {
  const { user } = useCurrentUser()
  const router = useRouter()
  const [auctions, setAuctions] = useState<AuctionDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 18+ verification check
  useEffect(() => {
    const checkVerification = async () => {
      if (!user) return

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        const userData = userDoc.data()

        if (!userData?.isAuctionVerified) {
          router.push('/verify-age')
        }
      } catch (err) {
        console.error('Error checking verification:', err)
      }
    }

    checkVerification()
  }, [user, router])

  // Real-time auctions listener
  useEffect(() => {
    const q = query(
      collection(db, 'auctions'),
      where('ended', '==', false),
      orderBy('endTime', 'asc')
    )

    const unsubscribe = onSnapshot(
      q,
      (querySnap) => {
        const auctionsList: AuctionDisplay[] = []
        querySnap.forEach((doc) => {
          const data = doc.data() as LiveAuction
          auctionsList.push({
            id: doc.id,
            cardName: data.cardName,
            imageUrl: data.imageUrl,
            currentBid: data.currentBid,
            bidCount: data.bidCount,
            endTime: data.endTime,
            timeLeft: calculateTimeLeft(data.endTime),
          })
        })
        setAuctions(auctionsList)
        setLoading(false)
      },
      (error) => {
        console.error('Failed to load auctions:', error)
        setError('Failed to load auctions')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  // Update countdown timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      setAuctions(prev => prev.map(auction => ({
        ...auction,
        timeLeft: calculateTimeLeft(auction.endTime),
      })))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const calculateTimeLeft = (endTime: Timestamp): string => {
    const now = Date.now()
    const endTimeMs = endTime.toMillis()
    const distance = endTimeMs - now

    if (distance <= 0) {
      return 'Ended'
    }

    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((distance % (1000 * 60)) / 1000)

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m ${seconds}s`
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href="/dashboard" className={styles.backButton}>
            ← Dashboard
          </Link>
          <div className={styles.titleSection}>
            <h1>🔴 Live Auctions</h1>
            <p>Actively bidding right now</p>
          </div>
        </div>
        
        <div className={styles.loadingMessage}>
          <div className={styles.spinner}></div>
          Loading auctions...
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Link href="/dashboard" className={styles.backButton}>
          ← Dashboard
        </Link>
        <div className={styles.titleSection}>
          <h1>🔴 Live Auctions</h1>
          <p>Actively bidding right now</p>
        </div>
      </div>

      {/* Error Message */}
      {error && <div style={{ color: '#ff6b6b', padding: '1rem', margin: '1rem' }}>{error}</div>}

      {/* Auctions Grid */}
      {auctions.length === 0 ? (
        <div className={styles.noAuctionsMessage}>
          <p>No auctions currently live</p>
          <p>Check back soon!</p>
        </div>
      ) : (
        <div className={styles.auctionsGrid}>
          {auctions.map(auction => (
            <Link key={auction.id} href={`/auctions/${auction.id}`}>
              <div className={styles.auctionCard}>
                {/* Card Image */}
                <div className={styles.cardImageWrapper}>
                  <img 
                    src={auction.imageUrl || '/placeholder-card.png'} 
                    alt={auction.cardName}
                    className={styles.cardImage}
                  />
                  <div className={styles.liveBadge}>🔴 LIVE</div>
                </div>

                {/* Card Info */}
                <div className={styles.cardInfo}>
                  <h3>{auction.cardName}</h3>
                  
                  {/* Bid Details Row 1 */}
                  <div className={styles.bidRow}>
                    <div className={styles.bidItem}>
                      <span className={styles.label}>Current Bid</span>
                      <span className={styles.value}>${auction.currentBid.toFixed(2)}</span>
                    </div>
                    
                    <div className={styles.bidItem}>
                      <span className={styles.label}>Bids</span>
                      <span className={styles.value}>{auction.bidCount}</span>
                    </div>
                  </div>

                  {/* Time Left */}
                  <div className={styles.timeLeft}>
                    <span className={styles.timeLabel}>⏳ Time Left:</span>
                    <span className={styles.timeValue}>{auction.timeLeft}</span>
                  </div>

                  {/* Action Button */}
                  <button className={styles.viewButton}>
                    View Auction →
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
