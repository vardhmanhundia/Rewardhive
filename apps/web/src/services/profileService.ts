/**
 * Extended user-profile service. Talks to /profile/details on the backend with
 * the stored Bearer token (same auth pattern as authService).
 */
import authService from '@/services/authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface SavedCard {
  card_id: string | null;
  name: string | null;
  category: string;
  custom: boolean;
}
export interface SavedBank {
  name: string;
}
export interface SavedGoal {
  text: string;
}
export interface SavedLoan {
  loan_type: string;
}

export interface ProfileDetails {
  occupation: string | null;
  company: string | null;
  relationship_status: string | null;
  family_size: number | null;
  location_state: string | null;
  location_country: string | null;
  household: string | null;
  car: string | null;
  travel_preference: string | null;
  us_status: string | null;
  us_status_detail: string | null;
  airline_ranking: string[];
  online_shopping_ranking: string[];
  offline_shopping_ranking: string[];
  cards: SavedCard[];
  banks: SavedBank[];
  goals: SavedGoal[];
  loans: SavedLoan[];
}

/** PUT payload — any subset of the editable fields. */
export type ProfileUpdate = Partial<ProfileDetails>;

function authHeaders(): Record<string, string> {
  const token = authService.getToken();
  if (!token) throw new Error('No token found');
  return { Authorization: `Bearer ${token}` };
}

class ProfileService {
  async getDetails(): Promise<ProfileDetails> {
    const res = await fetch(`${API_URL}/profile/details`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to load profile');
    }
    return res.json();
  }

  async updateDetails(payload: ProfileUpdate): Promise<ProfileDetails> {
    const res = await fetch(`${API_URL}/profile/details`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to save profile');
    }
    return res.json();
  }
}

export default new ProfileService();
