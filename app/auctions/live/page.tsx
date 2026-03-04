'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
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
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/currency'
import styles from '../../dashboard/dashboard.module.css'
import auctionStyles from './live.module.css'

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
  const { currency } = useCurrency()
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
      <div className={styles.content}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔴 Live Auctions</h1>
        <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.6)' }}>
          <div style={{ fontSize: '1.2rem' }}>Loading auctions...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.content}>
      {/* Page Header */}
      <div className={auctionStyles.pageHeader}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔴 Live Auctions</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>
            Actively bidding right now
          </p>
        </div>
        <Link href="/auctions/create" className={auctionStyles.createAuctionButton}>
          + Create Auction
        </Link>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{ 
          color: '#ff6b6b', 
          padding: '1rem', 
          background: 'rgba(255,107,107,0.1)', 
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {/* Auctions Grid */}
      {auctions.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '4rem 2rem',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No auctions currently live</p>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>Check back soon!</p>
        </div>
      ) : (
        <div className={auctionStyles.auctionsGrid}>
          {auctions.map(auction => (
            <Link key={auction.id} href={`/auctions/${auction.id}`}>
              <div className={auctionStyles.auctionCard}>
                {/* Card Image */}
                <div className={auctionStyles.cardImageWrapper}>
                  <Image
                    src={auction.imageUrl || '/placeholder-card.png'}
                    alt={auction.cardName}
                    width={300}
                    height={420}
                    sizes="(max-width: 768px) 100vw, 400px"
                    className={auctionStyles.cardImage}
                    unoptimized
                  />
                  <div className={auctionStyles.liveBadge}>🔴 LIVE</div>
                </div>

                {/* Card Info */}
                <div className={auctionStyles.cardInfo}>
                  <h3>{auction.cardName}</h3>
                  
                  {/* Bid Details Row 1 */}
                  <div className={auctionStyles.bidRow}>
                    <div className={auctionStyles.bidItem}>
                      <span className={auctionStyles.label}>Current Bid</span>
                      <span className={auctionStyles.value}>{formatCurrency(auction.currentBid, currency)}</span>
                    </div>
                    
                    <div className={auctionStyles.bidItem}>
                      <span className={auctionStyles.label}>Bids</span>
                      <span className={auctionStyles.value}>{auction.bidCount}</span>
                    </div>
                  </div>

                  {/* Time Left */}
                  <div className={auctionStyles.timeLeft}>
                    <span className={auctionStyles.timeLabel}>⏳ Time Left:</span>
                    <span className={auctionStyles.timeValue}>{auction.timeLeft}</span>
                  </div>

                  {/* Action Button */}
                  <button className={auctionStyles.viewButton}>
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
