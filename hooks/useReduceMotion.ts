import { useState, useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (active) setReduce(v); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { active = false; sub.remove(); };
  }, []);
  return reduce;
}
