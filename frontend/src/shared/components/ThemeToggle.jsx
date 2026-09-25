import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/**
 * Bascule clair / sombre — visible pour tous les utilisateurs.
 * variant: "onPrimary" (header bleu) | "default" (fond clair/sombre)
 */
export default function ThemeToggle({ className = '', variant = 'default', size = 'md' }) {
  const { isDark, toggleTheme } = useTheme();

  const dim = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const icon = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  const tones = {
    default:
      'border-border bg-surface/90 text-ink hover:border-primary/40 hover:bg-primary/5 '
      + 'dark:border-white/15 dark:bg-white/5 dark:text-surface dark:hover:bg-white/10 dark:hover:border-accent/50',
    onPrimary:
      'border-surface/25 bg-surface/10 text-surface hover:bg-surface/20 hover:border-accent/60',
    ghost:
      'border-transparent bg-transparent text-ink-muted hover:text-ink hover:bg-black/5 '
      + 'dark:text-surface/70 dark:hover:text-surface dark:hover:bg-white/10',
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
      aria-pressed={isDark}
      className={[
        'theme-toggle relative inline-flex items-center justify-center rounded-full border transition-all duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2',
        'focus-visible:ring-offset-surface dark:focus-visible:ring-offset-[transparent]',
        'active:scale-95 shadow-sm',
        dim,
        tones[variant] || tones.default,
        className,
      ].join(' ')}
    >
      <Sun
        className={[
          icon,
          'absolute transition-all duration-300',
          isDark ? 'scale-0 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100 text-accent',
        ].join(' ')}
        strokeWidth={2.2}
        aria-hidden
      />
      <Moon
        className={[
          icon,
          'absolute transition-all duration-300',
          isDark ? 'scale-100 rotate-0 opacity-100 text-accent' : 'scale-0 -rotate-90 opacity-0',
        ].join(' ')}
        strokeWidth={2.2}
        aria-hidden
      />
    </button>
  );
}
