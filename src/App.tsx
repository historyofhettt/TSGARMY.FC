import { Routes, Route } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import Home from "./pages/Home";
import Teams from "./pages/Teams";
import TeamDetail from "./pages/TeamDetail";
import Players from "./pages/Players";
import PlayerDetail from "./pages/PlayerDetail";
import Tournaments from "./pages/Tournaments";
import TournamentDetail from "./pages/TournamentDetail";
import Schedule from "./pages/Schedule";
import Live from "./pages/Live";
import Community from "./pages/Community";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Login from "./pages/Login";
import UsernameSelect from "./pages/UsernameSelect";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Leaderboard from "./pages/Leaderboard";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/Dashboard";
import TeamsAdmin from "./pages/admin/TeamsAdmin";
import PlayersAdmin from "./pages/admin/PlayersAdmin";
import HighlightsAdmin from "./pages/admin/HighlightsAdmin";
import TournamentsAdmin from "./pages/admin/TournamentsAdmin";
import TournamentAdminDetail from "./pages/admin/TournamentAdminDetail";
import PeopleAdmin from "./pages/admin/PeopleAdmin";
import MediaAdmin from "./pages/admin/MediaAdmin";
import CommentsAdmin from "./pages/admin/CommentsAdmin";
import UsersAdmin from "./pages/admin/UsersAdmin";
import RolesAdmin from "./pages/admin/RolesAdmin";
import AnalyticsDashboard from "./pages/admin/AnalyticsDashboard";
import SettingsAdmin from "./pages/admin/SettingsAdmin";
import ScheduleAdmin from "./pages/admin/ScheduleAdmin";
import LiveAdmin from "./pages/admin/LiveAdmin";
import LiveChannels from "./pages/admin/LiveChannels";
import MapsAdmin from "./pages/admin/MapsAdmin";
import AchievementsAdmin from "./pages/admin/AchievementsAdmin";
import CardsAdmin from "./pages/admin/CardsAdmin";
import StaffAdmin from "./pages/admin/StaffAdmin";
import TeamMediaAdmin from "./pages/admin/TeamMediaAdmin";
import XpSettings from "./pages/admin/XpSettings";
import StreakSettingsAdmin from "./pages/admin/StreakSettingsAdmin";
import PredictionsAdmin from "./pages/admin/PredictionsAdmin";
import QuizAdmin from "./pages/admin/QuizAdmin";
import XpTasksAdmin from "./pages/admin/XpTasksAdmin";
import WeeklyTopFanAdmin from "./pages/admin/WeeklyTopFanAdmin";
import Streak from "./pages/fan/Streak";
import Quiz from "./pages/fan/Quiz";
import Tasks from "./pages/fan/Tasks";
import WeeklyTopFan from "./pages/fan/WeeklyTopFan";
import Cards from "./pages/Cards";
import CardCollection from "./pages/CardCollection";
import FanProfile from "./pages/fan/FanProfile";
import NotificationCenter from "./pages/NotificationCenter";
import NotificationTypesAdmin from "./pages/admin/NotificationTypesAdmin";
import AnnouncementsAdmin from "./pages/admin/AnnouncementsAdmin";
import Media from "./pages/Media";
import MediaAlbum from "./pages/MediaAlbum";
import MediaPageAdmin from "./pages/admin/MediaPageAdmin";
import FanSpotlightAdmin from "./pages/admin/FanSpotlightAdmin";
import FanSpotlight from "./pages/FanSpotlight";
import CommunityManager from "./pages/admin/CommunityManager";
import SponsoredAds from "./pages/admin/SponsoredAds";
import DeveloperInfoAdmin from "./pages/admin/DeveloperInfoAdmin";
import FanRewardsAdmin from "./pages/admin/FanRewardsAdmin";
import RedemptionsAdmin from "./pages/admin/RedemptionsAdmin";
import RedeemRewards from "./pages/RedeemRewards";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/teams/:slug" element={<TeamDetail />} />
        <Route path="/players" element={<Players />} />
        <Route path="/players/:slug" element={<PlayerDetail />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/tournaments/:slug" element={<TournamentDetail />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/live" element={<Live />} />
        <Route path="/community" element={<Community />} />
        <Route path="/media" element={<Media />} />
        <Route path="/media/album/:id" element={<MediaAlbum />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/login" element={<Login />} />
        <Route path="/username-select" element={<UsernameSelect />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/u/:username" element={<UserProfile />} />
        <Route path="/leaderboard" element={<Leaderboard />} />

        <Route path="/fan/quiz" element={<Quiz />} />
        <Route path="/fan/tasks" element={<Tasks />} />
        <Route path="/fan/weekly-top-fan" element={<WeeklyTopFan />} />
         <Route path="/fan/streak" element={<Streak />} />

         <Route path="/cards" element={<Cards />} />
         <Route path="/collection" element={<CardCollection />} />
         <Route path="/fans/:username" element={<FanProfile />} />

         <Route path="/rewards" element={<RedeemRewards />} />

         <Route path="/notifications" element={<NotificationCenter />} />

        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/teams" element={<TeamsAdmin />} />
        <Route path="/admin/players" element={<PlayersAdmin />} />
        <Route path="/admin/highlights" element={<HighlightsAdmin />} />
        <Route path="/admin/staff" element={<StaffAdmin />} />
        <Route path="/admin/team-media" element={<TeamMediaAdmin />} />
        <Route path="/admin/tournaments" element={<TournamentsAdmin />} />
        <Route path="/admin/tournaments/:id" element={<TournamentAdminDetail />} />
        <Route path="/admin/schedule" element={<ScheduleAdmin />} />
        <Route path="/admin/live" element={<LiveAdmin />} />
        <Route path="/admin/live-channels" element={<LiveChannels />} />
        <Route path="/admin/maps" element={<MapsAdmin />} />
        <Route path="/admin/people" element={<PeopleAdmin />} />
        <Route path="/admin/media" element={<MediaAdmin />} />
        <Route path="/admin/comments" element={<CommentsAdmin />} />
        <Route path="/admin/users" element={<UsersAdmin />} />
        <Route path="/admin/roles" element={<RolesAdmin />} />
        <Route path="/admin/settings" element={<SettingsAdmin />} />
        <Route path="/admin/achievements" element={<AchievementsAdmin />} />
        <Route path="/admin/xp-settings" element={<XpSettings />} />
        <Route path="/admin/streak-settings" element={<StreakSettingsAdmin />} />
        <Route path="/admin/predictions" element={<PredictionsAdmin />} />
        <Route path="/admin/quiz" element={<QuizAdmin />} />
        <Route path="/admin/xp-tasks" element={<XpTasksAdmin />} />
         <Route path="/admin/weekly-top-fan" element={<WeeklyTopFanAdmin />} />
         <Route path="/admin/cards" element={<CardsAdmin />} />
         <Route path="/admin/analytics" element={<AnalyticsDashboard />} />
         <Route path="/admin/notification-types" element={<NotificationTypesAdmin />} />
         <Route path="/admin/announcements" element={<AnnouncementsAdmin />} />
        <Route path="/admin/media-page" element={<MediaPageAdmin />} />
        <Route path="/spotlight" element={<FanSpotlight />} />
        <Route path="/spotlight/:id" element={<FanSpotlight />} />
        <Route path="/admin/fan-spotlight" element={<FanSpotlightAdmin />} />
        <Route path="/admin/community" element={<CommunityManager />} />
        <Route path="/admin/sponsored-ads" element={<SponsoredAds />} />
         <Route path="/admin/developer-info" element={<DeveloperInfoAdmin />} />
         <Route path="/admin/fan-rewards" element={<FanRewardsAdmin />} />
         <Route path="/admin/redemptions" element={<RedemptionsAdmin />} />


        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster richColors position="top-center" theme="dark" />
    </>
  );
}
