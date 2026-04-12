/**
 * matchFieldsToTemplate
 *
 * Maps freeform {label, value} pairs (from the Global Library or raw Haiku extraction)
 * to studio template field IDs using fuzzy label matching.
 *
 * Logic: for each extracted field, find the template field whose name best
 * matches the label using prefix/contains comparisons on normalised strings.
 * Normalisation strips punctuation and collapses whitespace.
 *
 * Used in two places:
 *  1. scrape-spec.ts  — matching newly-scraped Haiku fields to studio template fields
 *  2. save/route.ts   — matching global_spec_fields to studio template fields at pin time
 *
 * Returns an array of { field_id, label, value } ready for spec_field_values insert.
 */

export interface RawField {
  label: string;
  value: string;
}

export interface TemplateField {
  id: string;
  name: string;
  template_id: string;
}

export interface MatchedFieldValue {
  field_id: string;
  label: string;
  value: string;
}

/**
 * Normalise a label string for fuzzy comparison.
 * Strips punctuation, collapses whitespace, lowercases.
 */
function normaliseLabel(s: string): string {
  return s.toLowerCase().replace(/[:()\s]+/g, " ").trim();
}

/**
 * Match a list of raw {label, value} pairs against a list of template fields.
 * Returns only the matches that have a non-empty value.
 * Deduplicates by field_id (first match wins).
 */
export function matchFieldsToTemplate(
  rawFields: RawField[],
  templateFields: TemplateField[]
): MatchedFieldValue[] {
  const results: MatchedFieldValue[] = [];
  const seenFieldIds = new Set<string>();

  for (const raw of rawFields) {
    if (!raw.value?.trim()) continue;

    const extLabel = normaliseLabel(raw.label);

    const match = templateFields.find((tf) => {
      const tfLabel = normaliseLabel(tf.name);
      return (
        tfLabel === extLabel ||
        extLabel.startsWith(tfLabel) ||
        tfLabel.startsWith(extLabel) ||
        extLabel.includes(tfLabel) ||
        tfLabel.includes(extLabel)
      );
    });

    if (match && !seenFieldIds.has(match.id)) {
      seenFieldIds.add(match.id);
      results.push({
        field_id: match.id,
        label: match.name,
        value: raw.value,
      });
    }
  }

  return results;
}
