import { useState, useCallback } from 'react';

export function useExpandedSections(initial: Record<string, boolean>) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(initial);

  const toggleSection = useCallback((id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return { expandedSections, toggleSection, setExpandedSections };
}
