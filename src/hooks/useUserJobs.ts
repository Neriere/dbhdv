import { useState, useEffect, useCallback } from "react";
import {
  UserJobSettings,
  getUserJobSettings,
  setUserJobLevel,
  setAllUserJobLevels,
  toggleUserJobsEnabled,
  canUserCraftItem,
  canUserMageItem,
  canUserCraftOrMageItem,
  JobCategory,
} from "../services/userJobsService";

export function useUserJobs() {
  const [settings, setSettings] = useState<UserJobSettings>(() => getUserJobSettings());

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e?.detail) {
        setSettings({ ...e.detail });
      } else {
        setSettings(getUserJobSettings());
      }
    };
    window.addEventListener("dofus_user_jobs_updated", handleUpdate);
    return () => {
      window.removeEventListener("dofus_user_jobs_updated", handleUpdate);
    };
  }, []);

  const setJobLevel = useCallback((jobId: number, level: number) => {
    setUserJobLevel(jobId, level);
  }, []);

  const setAllLevels = useCallback((level: number, category?: JobCategory) => {
    setAllUserJobLevels(level, category);
  }, []);

  const toggleEnabled = useCallback((enabled?: boolean) => {
    return toggleUserJobsEnabled(enabled);
  }, []);

  const canCraft = useCallback(
    (item: any) => canUserCraftItem(item, settings),
    [settings]
  );

  const canMage = useCallback(
    (item: any) => canUserMageItem(item, settings),
    [settings]
  );

  const canCraftOrMage = useCallback(
    (item: any) => canUserCraftOrMageItem(item, settings),
    [settings]
  );

  return {
    settings,
    isEnabled: settings.enabled,
    jobLevels: settings.jobs,
    setJobLevel,
    setAllLevels,
    toggleEnabled,
    canCraft,
    canMage,
    canCraftOrMage,
  };
}
