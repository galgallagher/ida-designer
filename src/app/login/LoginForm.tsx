/**
 * LoginForm — Client Component
 *
 * This is a "use client" component because it uses:
 * - useActionState (React hook for tracking server action state)
 * - User interaction (form submission, showing error messages)
 *
 * The actual sign-in logic lives in actions.ts (server-side).
 * This component just renders the form and shows the result.
 */

"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

// Initial state for the form — no error to start
const initialState = { error: null };

export default function LoginForm() {
  // useActionState connects this form to the signIn server action.
  // state = { error: string | null }
  // formAction = the function to pass to the form's action prop
  // isPending = true while the server is processing the request
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {/* Email field */}
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-[10px] font-semibold tracking-[0.15em] uppercase text-[#9A9590]"
        >
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isPending}
          className="
            w-full px-4 py-3 rounded-lg border border-[#E4E1DC]
            bg-white text-[#1A1A1A] text-sm
            placeholder:text-[#C8C4BE]
            focus:outline-none focus:ring-2 focus:ring-[#FFDE28] focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-shadow
          "
          placeholder="you@studio.com"
        />
      </div>

      {/* Password field */}
      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-[10px] font-semibold tracking-[0.15em] uppercase text-[#9A9590]"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending}
          className="
            w-full px-4 py-3 rounded-lg border border-[#E4E1DC]
            bg-white text-[#1A1A1A] text-sm
            placeholder:text-[#C8C4BE]
            focus:outline-none focus:ring-2 focus:ring-[#FFDE28] focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-shadow
          "
          placeholder="••••••••"
        />
      </div>

      {/* Error message — only shown when sign-in fails */}
      {state?.error && (
        <div
          role="alert"
          className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
        >
          {state.error}
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isPending}
        className="
          w-full py-3 px-6 rounded-lg
          bg-[#FFDE28] text-[#1A1A1A]
          text-sm font-semibold tracking-wide
          hover:bg-[#F5D400] active:bg-[#ECC900]
          disabled:opacity-60 disabled:cursor-not-allowed
          transition-colors
          mt-2
        "
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>

      {/* Forgot password link */}
      <p className="text-center">
        <a
          href="/forgot-password"
          className="text-xs text-[#9A9590] hover:text-[#1A1A1A] transition-colors"
        >
          Forgot your password?
        </a>
      </p>
    </form>
  );
}
