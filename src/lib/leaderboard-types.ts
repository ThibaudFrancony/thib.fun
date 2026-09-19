export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  avatarPreset: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
};

export type LeaderboardMe = {
  rank: number;
  points: number;
  wins: number;
  losses: number;
  draws: number;
};

export type LeaderboardPayload = {
  entries: LeaderboardEntry[];
  me: LeaderboardMe | null;
};
