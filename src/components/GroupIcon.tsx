import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Sparkles,
  Compass,
  Feather,
  Cpu,
  Globe,
  Lightbulb,
  Heart,
  Scroll,
  Layers,
  Flame,
  Award,
  Folder,
} from 'lucide-react';
import { motion, useSpring, useTransform } from 'motion/react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  BookOpen,
  Sparkles,
  Compass,
  Feather,
  Cpu,
  Globe,
  Lightbulb,
  Heart,
  Scroll,
  Layers,
  Flame,
  Award,
};

export const GroupIcon: React.FC<{
  name: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ name, className = 'w-4 h-4', style }) => {
  const IconComp = ICON_MAP[name] || Folder;
  return <IconComp className={className} style={style} />;
};

export const AnimatedCounter: React.FC<{
  value: number;
  className?: string;
}> = ({ value, className = '' }) => {
  const spring = useSpring(value, { stiffness: 110, damping: 20 });
  const display = useTransform(spring, (current) =>
    Math.round(current).toLocaleString('en-US')
  );
  const [text, setText] = useState(() => value.toLocaleString('en-US'));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    const unsub = display.on('change', (v) => setText(v));
    return unsub;
  }, [display]);

  return <span className={`tabular-nums font-mono ${className}`}>{text}</span>;
};
