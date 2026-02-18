import React, { useState } from 'react';

export function ResetPassword() {
  const tempUser = JSON.parse(localStorage.getItem('at_temp_user') || 'null');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  if (!tempUser) {
    window.location.href = "/";
    return null;
  }

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || !confirmPassword)
      return setError("Please fill all fields.");

    if (newPassword !== confirmPassword)
      return setError("Passwords do not match.");

    if (newPassword.length < 6)
      return setError("Password must be at least 6 characters.");

    const users = JSON.parse(localStorage.getItem('at_users') || '[]');

    const updatedUsers = users.map((u: any) =>
      u.username === tempUser.username
        ? {
            ...u,
            password: newPassword,
            mustChangePassword: false
          }
        : u
    );

    localStorage.setItem('at_users', JSON.stringify(updatedUsers));
    localStorage.removeItem('at_temp_user');

    alert("Password changed successfully. Please login again.");

    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <form
        onSubmit={handleReset}
        className="bg-neutral-900 p-8 rounded-xl w-full max-w-md space-y-5"
      >
        <h2 className="text-white text-2xl font-bold">
          Reset Your Password
        </h2>

        {error && (
          <div className="text-red-400 text-sm">{error}</div>
        )}

        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          className="w-full p-3 bg-neutral-800 text-white rounded-lg"
        />

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          className="w-full p-3 bg-neutral-800 text-white rounded-lg"
        />

        <button
          type="submit"
          className="w-full bg-[#FFD700] text-black font-bold py-3 rounded-lg"
        >
          Update Password
        </button>
      </form>
    </div>
  );
}