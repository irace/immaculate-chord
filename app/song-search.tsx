'use client';
import { useEffect, useState } from 'react';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from '@/components/ui/combobox';
import type { CatalogHit } from '@/lib/catalog/types';
export default function SongSearch({
  value,
  onChange,
  disabled,
}: {
  value: CatalogHit | null;
  onChange: (v: CatalogHit | null) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogHit[]>([]);
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (value || query.trim().length < 3) {
      setResults(value ? [value] : []);
      setStatus('');
      return;
    }
    const controller = new AbortController();
    setStatus('Searching…');
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/catalog/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as {
          results: CatalogHit[];
          error?: string;
        };
        if (!response.ok) throw new Error(data.error);
        if (controller.signal.aborted) return;
        setResults(data.results);
        setStatus(
          data.results.length
            ? ''
            : 'No recordings found. Try adding the artist’s name.',
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setResults([]);
          setStatus(
            error instanceof Error
              ? error.message
              : 'Song search is unavailable.',
          );
        }
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, value]);
  return (
    <div className="song-search">
      <label htmlFor="catalog-song">Song or artist</label>
      <Combobox
        items={results}
        value={value}
        filter={null}
        disabled={disabled}
        itemToStringLabel={(item: CatalogHit) =>
          `${item.title} — ${item.artist}`
        }
        isItemEqualToValue={(a: CatalogHit, b: CatalogHit) =>
          a.id === b.id && a.provider === b.provider
        }
        onInputValueChange={(text, details) => {
          setQuery(text);
          if (details.reason === 'input-change') {
            onChange(null);
            setResults([]);
          }
        }}
        onValueChange={(item: CatalogHit | null) => onChange(item)}
      >
        <ComboboxInput
          id="catalog-song"
          placeholder="Search for a song and artist"
          showTrigger={false}
          autoComplete="off"
        />
        <ComboboxContent className="catalog-results">
          <ComboboxList>
            {(item: CatalogHit) => (
              <ComboboxItem
                key={`${item.provider}:${item.id}`}
                value={item}
                className="catalog-result"
              >
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.artist}</small>
                  <small>
                    {[item.album, item.year, item.version]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {status && (
        <p className="small-print" role="status">
          {status}
        </p>
      )}
      {value && (
        <p className="small-print">
          {[value.album, value.year, value.version].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  );
}
