-- Migration 011: auth trigger
-- Automatically creates a profile row whenever a new user signs up via Supabase Auth.
-- This means the app never has to manually call an INSERT after sign-up.

-- The function runs as SECURITY DEFINER, meaning it runs with the privileges of
-- the function owner (postgres), not the user calling it. This is required because
-- the profiles table has RLS enabled and new users don't have a row yet.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, platform_role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    COALESCE(new.raw_user_meta_data->>'platform_role', 'studio_member')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger first if it already exists (safe to re-run)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Fire the function after every new row is inserted into auth.users (i.e. sign-up)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
