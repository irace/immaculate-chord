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
  const [artist, setArtist] = useState('');
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
          `/api/catalog/search?q=${encodeURIComponent(query.trim())}&artist=${encodeURIComponent(artist.trim())}`,
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
            : 'No recordings found. Add or adjust the artist to narrow your search.',
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
  }, [query, artist, value]);
  return (
    <div className="song-search">
      <label htmlFor="catalog-song">Song title</label>
      <Combobox
        items={results}
        value={value}
        inputValue={query}
        filter={null}
        disabled={disabled}
        itemToStringLabel={(item: CatalogHit) => item.title}
        isItemEqualToValue={(a: CatalogHit, b: CatalogHit) =>
          a.id === b.id && a.provider === b.provider
        }
        onInputValueChange={(text, details) => {
          if (details.reason === 'input-change') {
            setQuery(text);
            onChange(null);
            setResults([]);
          }
        }}
        onValueChange={(item: CatalogHit | null) => {
          onChange(item);
          if (item) setQuery(item.title);
        }}
      >
        <ComboboxInput
          id="catalog-song"
          placeholder="Search by song title"
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
                  <small>{item.version}</small>
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <label className="catalog-artist-label" htmlFor="catalog-artist">
        Artist (optional)
      </label>
      <input
        id="catalog-artist"
        value={artist}
        disabled={disabled}
        maxLength={120}
        placeholder="Narrow the results, e.g. The Beatles"
        autoComplete="off"
        onChange={(event) => {
          if (value) setQuery(value.title);
          setArtist(event.target.value);
          onChange(null);
          setResults([]);
        }}
      />
      {status && (
        <p className="small-print" role="status">
          {status}
        </p>
      )}
      {value && (
        <p className="small-print">
          {[value.artist, value.version].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  );
}
