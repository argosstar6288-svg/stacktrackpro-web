import AuctionsPanel from "../../components/dashboard/AuctionsPanel";
import CollectionChart from "../../components/dashboard/CollectionChart";
import FriendsFeed from "../../components/dashboard/FriendsFeed";
import RecentActivity from "../../components/dashboard/RecentActivity";
import StatsCards from "../../components/dashboard/StatsCards";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  return (
    <div className={styles.content}>
      <StatsCards />
      <div className={styles.grid}>
        <CollectionChart />
        <RecentActivity />
      </div>
      <div className={styles.grid}>
        <AuctionsPanel />
        <FriendsFeed />
      </div>
    </div>
  );
}
