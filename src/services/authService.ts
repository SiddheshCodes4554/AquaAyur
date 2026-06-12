import { supabase } from '../lib/supabase';

/**
 * Service handling all authentication requests with Supabase.
 */
export const authService = {
  /**
   * Register a new user using email and password.
   * Auto-triggers profile creation in database.
   */
  async signUp(email: string, password: string, fullName: string): Promise<void> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: 'aquaayur://login',
      },
    });
    
    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Login an existing user using credentials.
   */
  async signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Sign out the active user session.
   */
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Trigger a password reset email for the user.
   * User will be redirected back to the app via deep link.
   */
  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'aquaayur://reset-password',
    });
    
    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Update the logged-in user's password.
   * Used during the password reset callback flow.
   */
  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({
      password: password,
    });
    
    if (error) {
      throw new Error(error.message);
    }
  }
};
