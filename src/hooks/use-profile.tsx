import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { Profile } from '@/types/index';

const KEY = 'KLARITY_PROFILE_V1';

export const DEFAULT_PROFILE: Profile = {
  id: 'default',
  label: 'You',
  values: 'balanced',
  conditions: [],
};

interface ProfileContextValue {
  profile: Profile;
  loaded: boolean;   // true once AsyncStorage has been read
  setProfile: (p: Profile) => void;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: DEFAULT_PROFILE,
  loaded: false,
  setProfile: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile>(DEFAULT_PROFILE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(raw => { if (raw) setProfileState(JSON.parse(raw) as Profile); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function setProfile(p: Profile) {
    setProfileState(p);
    AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {});
  }

  return (
    <ProfileContext.Provider value={{ profile, loaded, setProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}
