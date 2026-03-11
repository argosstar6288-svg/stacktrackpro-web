"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./help.module.css";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQItem[] = [
  {
    category: "Getting Started",
    question: "How do I add cards to my collection?",
    answer: "Navigate to Dashboard → Collection → Add Card. You can either use the AI Card Scanner to automatically detect card details from a photo, or manually enter the information."
  },
  {
    category: "Getting Started",
    question: "What information do I need to add a card?",
    answer: "Required fields include card name and value. Optional fields include player name, brand, year, sport, condition, and rarity. The AI scanner can fill most of these automatically."
  },
  {
    category: "AI Card Scanner",
    question: "How does the AI Card Scanner work?",
    answer: "The AI Card Scanner uses OpenAI's Vision API to analyze photos of your cards. It identifies the player, year, brand, sport, condition, and grading information, then estimates the market value based on these factors."
  },
  {
    category: "AI Card Scanner",
    question: "What makes a good scan photo?",
    answer: "For best results: ensure good lighting (natural light works best), capture the entire card in frame, keep the card flat and in focus, and avoid glare, shadows, or reflections on the card surface."
  },
  {
    category: "AI Card Scanner",
    question: "Can the scanner detect graded cards?",
    answer: "Yes! The AI can identify graded cards from PSA, BGS, SGC, CGC, and other major grading companies. It will read the grade and apply appropriate value premiums."
  },
  {
    category: "Collections",
    question: "How do I organize my collection?",
    answer: "Your collection page includes search, sort, and filter options. You can filter by sport, search by player or card name, and sort by value, name, or date added."
  },
  {
    category: "Collections",
    question: "Can I edit or delete cards?",
    answer: "Yes, click the edit (✏️) icon on any card to update its information, or click the delete (🗑️) icon to remove it from your collection."
  },
  {
    category: "Market & Portfolio",
    question: "How is my portfolio value calculated?",
    answer: "Your total portfolio value is the sum of all card values in your collection. The market graph shows average card value trends over the past 30 days."
  },
  {
    category: "Market & Portfolio",
    question: "Where does pricing data come from?",
    answer: "Card values are based on your manual entries or AI estimates. The AI considers player popularity, card scarcity, condition/grade, brand prestige, and recent market trends."
  },
  {
    category: "Auctions",
    question: "How do I create an auction?",
    answer: "From the Auction page, click 'Create Auction' and fill in the details including title, starting bid, duration, and description. You can link cards from your collection to the auction. Note: You must be 18+ to participate."
  },
  {
    category: "Auctions",
    question: "What are the auction age requirements?",
    answer: "You must be at least 18 years of age to participate in auctions on StackTrack Pro. This applies to both buying and selling. You'll be asked to confirm your age when accessing auctions for the first time."
  },
  {
    category: "Auctions",
    question: "What are the auction fees?",
    answer: "StackTrack Pro charges a 15% fee on successful auction sales. This covers payment processing, platform maintenance, and buyer/seller protection."
  },
  {
    category: "Auctions",
    question: "What are the auction rules?",
    answer: "All auctions are governed by our comprehensive Auction Rules which cover bidding guidelines, seller obligations, prohibited items, fees, and dispute resolution. You can review the full rules at /legal/auction-rules."
  },
  {
    category: "Messaging",
    question: "How do I message other users?",
    answer: "Go to Dashboard → Inbox to view your conversations. Click 'New Message' to start a chat with another user. You'll see unread message counts in the sidebar."
  },
  {
    category: "Account",
    question: "How do I update my account settings?",
    answer: "Navigate to Settings from the dashboard sidebar. Here you can manage notification preferences, theme settings, and account actions like signing out."
  },
  {
    category: "Account",
    question: "How do I reset my password?",
    answer: "Visit the login page and click 'Forgot Password'. Enter your email address and you'll receive a password reset link."
  },
  {
    category: "Pricing & Plans",
    question: "What subscription plans are available?",
    answer: "StackTrack Pro offers Starter ($9.99/month), Pro ($19.99/month), and Lifetime ($299 one-time) plans. Each tier includes different features like unlimited cards, AI scans, and advanced analytics."
  },
  {
    category: "Technical",
    question: "What browsers are supported?",
    answer: "StackTrack Pro works best on modern browsers including Chrome, Firefox, Safari, and Edge. Make sure JavaScript is enabled for full functionality."
  },
  {
    category: "Technical",
    question: "Is my data secure?",
    answer: "Yes, all data is stored securely in Firebase with industry-standard encryption. Your card collection, messages, and personal information are protected."
  }
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const categories = ["All", ...Array.from(new Set(faqs.map(faq => faq.category)))];

  const filteredFAQs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === "All" || faq.category === selectedCategory;
    const matchesSearch = 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Support</p>
          <h1 className={styles.title}>Help & FAQ</h1>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={`panel ${styles.panel}`}>
            <div className={styles.searchBox}>
              <input
                type="text"
                placeholder="Search for help..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <div className={styles.categories}>
              {categories.map(category => (
                <button
                  key={category}
                  className={`${styles.categoryButton} ${
                    selectedCategory === category ? styles.categoryButtonActive : ""
                  }`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </section>

          <section className={`panel ${styles.panel}`}>
            <div className={styles.faqList}>
              {filteredFAQs.length > 0 ? (
                filteredFAQs.map((faq, index) => (
                  <div key={index} className={styles.faqItem}>
                    <button
                      className={styles.faqQuestion}
                      onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                    >
                      <span>{faq.question}</span>
                      <span className={styles.faqIcon}>
                        {expandedIndex === index ? "−" : "+"}
                      </span>
                    </button>
                    {expandedIndex === index && (
                      <div className={styles.faqAnswer}>
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className={styles.noResults}>
                  No results found. Try a different search term or category.
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className={styles.side}>
          <section className={`panel ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Quick Links</h2>
            </div>
            <div className={styles.quickLinks}>
              <Link href="/dashboard/scan" className={styles.quickLink}>
                <span className={styles.quickLinkIcon}>📷</span>
                <span>Scan a Card</span>
              </Link>
              <Link href="/dashboard/collection" className={styles.quickLink}>
                <span className={styles.quickLinkIcon}>📚</span>
                <span>View Collection</span>
              </Link>
              <Link href="/auction" className={styles.quickLink}>
                <span className={styles.quickLinkIcon}>🔨</span>
                <span>Browse Auctions</span>
              </Link>
              <Link href="/dashboard/settings" className={styles.quickLink}>
                <span className={styles.quickLinkIcon}>⚙️</span>
                <span>Settings</span>
              </Link>
            </div>
          </section>

          <section className={`panel ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Need More Help?</h2>
            </div>
            <div className={styles.contactInfo}>
              <p className={styles.contactText}>
                Can't find what you're looking for? Our support team is here to help.
              </p>
              <button className={styles.contactButton}>
                Contact Support
              </button>
            </div>
          </section>

          <section className={`panel ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Resources</h2>
            </div>
            <div className={styles.resourceLinks}>
              <a href="#" className={styles.resourceLink}>📖 Documentation</a>
              <a href="#" className={styles.resourceLink}>🎥 Video Tutorials</a>
              <a href="#" className={styles.resourceLink}>💬 Community Forum</a>
              <a href="#" className={styles.resourceLink}>📧 Email Support</a>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
