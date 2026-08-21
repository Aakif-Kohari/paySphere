import React, { useState, ChangeEvent, FormEvent } from 'react';

// 1. Explicitly Type the User Profile Domain Model
export interface UserProfileData {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'coordinator' | 'student';
  avatarUrl?: string;
  bio?: string;
}

// 2. Define Rigorous Component Prop Bindings
interface UserProfileProps {
  initialProfile: UserProfileData;
  onProfileUpdate: (updatedProfile: UserProfileData) => Promise<void>;
  isReadOnly?: boolean;
}

export default function UserProfile({ 
  initialProfile, 
  onProfileUpdate, 
  isReadOnly = false 
}: UserProfileProps) {
  // 3. Bind Component State Types Cleanly
  const [profile, setProfile] = useState<UserProfileData>(initialProfile);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // 4. Type the Input Change Event Handler Element
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 5. Type the Form Submission Transaction Event Handler
  const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setErrorText(null);

    try {
      await onProfileUpdate(profile);
      setIsEditing(false);
    } catch (err: any) {
      setErrorText(err?.message || 'An error occurred while synchronizing profile changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm transition-all">
      <div className="flex items-center gap-4 border-b dark:border-gray-700 pb-4 mb-6">
        <img 
          src={profile.avatarUrl || 'https://unsplash.com'} 
          alt={`${profile.name}'s Avatar Profile Photo`} 
          className="w-16 h-16 rounded-full object-cover shadow border border-gray-100 dark:border-gray-600"
        />
        <div>
          <h3 className="font-extrabold text-gray-900 dark:text-gray-100 text-lg leading-tight">{profile.name}</h3>
          <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            {profile.role}
          </span>
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Full Name</label>
          <input
            type="text"
            name="name"
            value={profile.name}
            onChange={handleInputChange}
            disabled={!isEditing || saving || isReadOnly}
            className="w-full px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-60 focus:outline-none focus:border-indigo-500 transition-all"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Contact Email Address</label>
          <input
            type="email"
            name="email"
            value={profile.email}
            onChange={handleInputChange}
            disabled={!isEditing || saving || isReadOnly}
            className="w-full px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-60 focus:outline-none focus:border-indigo-500 transition-all"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Biography</label>
          <textarea
            name="bio"
            value={profile.bio || ''}
            onChange={handleInputChange}
            disabled={!isEditing || saving || isReadOnly}
            rows={3}
            className="w-full px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-60 focus:outline-none focus:border-indigo-500 transition-all resize-none"
            placeholder="Tell us about yourself..."
          />
        </div>

        {errorText && (
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-2.5 rounded-xl border border-red-200 dark:border-red-900/40">
            ⚠️ {errorText}
          </p>
        )}

        {!isReadOnly && (
          <div className="flex justify-end gap-2 pt-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => { setProfile(initialProfile); setIsEditing(false); }}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 text-xs font-black uppercase tracking-wider rounded-xl shadow transition-all"
              >
                Edit Profile
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
