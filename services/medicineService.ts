import axios from 'axios';
import { AppError, handleError, NoResultsError, NotFoundError } from '../utils/errors';

const RXNORM_API_BASE_URL = 'https://rxnav.nlm.nih.gov/REST';

// Interface for the structure of a drug concept returned by the search
export interface DrugConcept {
  rxcui: string; // RxNorm Concept Unique Identifier
  name: string;
  synonym: string;
  tty: string; // Term Type (e.g., 'IN' for Ingredient, 'BN' for Brand Name)
  language: string;
  suppress: string;
  umlscui: string;
}

// Interface for the structure of the API response for getDrugs
interface GetDrugsResponse {
  drugGroup: {
    name: string | null;
    conceptGroup: {
      tty: string;
      conceptProperties: DrugConcept[];
    }[] | null; // Can be null if no results
  };
}

// Interface for a single property key-value pair returned by the API
interface PropertyNameValuePair {
  propName: string;
  propValue: string;
}

// Interface for the structure of drug properties (as we want to structure it)
// This will be built from the PropertyNameValuePair array
export interface ProcessedDrugProperties {
  rxcui: string;
  name: string;
  tty: string;
  synonyms?: string[];
  ingredients?: string[]; // From INGREDIENT, ACTIVE_INGREDIENTS?
  dosageForms?: string[]; // From ADMINISTERED_DOSAGE_FORM, DOSAGEFORM?
  ndcs?: string[];
  strengths?: string[]; // From Strength, AVAILABLE_STRENGTH, INGREDIENT_AND_STRENGTH?
  brandNames?: string[]; // From BRAND_NAME
  manufacturer?: string; // From MANUFACTURER (Usually single?)
  deaSchedule?: string; // From DEA_SCHEDULE
  // Add other processed properties as needed
  rawProperties: PropertyNameValuePair[]; // Keep the raw list for reference or fallback
}

// Interface for the getAllProperties response from the API
interface GetAllPropertiesResponse {
  propConceptGroup: {
    propConcept: PropertyNameValuePair[];
  };
}

/**
 * Searches for drugs in the RxNorm database by name.
 * @param {string} drugName The name of the drug to search for.
 * @returns {Promise<DrugConcept[]>} A promise that resolves to an array of drug concepts.
 */
export const searchDrugsByName = async (drugName: string): Promise<DrugConcept[]> => {
  if (!drugName || drugName.trim().length < 3) {
    // Consider if this should be a ValidationError or just return empty
    // For now, returning empty is fine as it's a pre-flight check, not an API error.
    console.warn('[medicineService] Drug search query too short, returning empty.');
    return [];
  }

  try {
    const response = await axios.get<GetDrugsResponse>(`${RXNORM_API_BASE_URL}/drugs.json`, {
      params: {
        name: drugName.trim(),
      },
    });

    const concepts: DrugConcept[] = [];
    if (response.data?.drugGroup?.conceptGroup) {
      response.data.drugGroup.conceptGroup.forEach(group => {
        if (group.conceptProperties) {
          concepts.push(...group.conceptProperties);
        }
      });
    }

    if (concepts.length === 0) {
      // Optional: Throw NoResultsError if you want to explicitly handle this case upstream
      // For now, returning an empty array might be preferred by some UI logic.
      // If you want to throw an error:
      // throw new NoResultsError(drugName, `No drugs found matching "${drugName}".`);
      console.log(`[medicineService] No drugs found for query: "${drugName}"`);
    }

    return concepts;
  } catch (error) {
    console.error('Error searching RxNorm drugs:', error); // Keep console log for dev
    // Throw a structured error that can be caught and handled by UI
    throw handleError(error, `searching for drugs related to "${drugName}"`);
  }
};

/**
 * Fetches detailed properties for a specific drug using its RxCUI.
 * @param {string} rxcui The RxNorm Concept Unique Identifier.
 * @returns {Promise<ProcessedDrugProperties | null>} A promise that resolves to the processed drug properties or null if not found.
 * @throws {AppError} Throws an AppError if fetching fails or if the drug is not found (as NotFoundError).
 */
export const getDrugDetailsByRxcui = async (rxcui: string): Promise<ProcessedDrugProperties | null> => {
  if (!rxcui) {
    // This case could also throw a ValidationError if an empty rxcui is considered an invalid input
    // For now, returning null is consistent with "not found" but consider implications.
    console.warn('[medicineService] rxcui is null or empty in getDrugDetailsByRxcui');
    // To be more explicit about "not found" due to missing rxcui:
    // throw new NotFoundError('Drug', `Details cannot be fetched without an RxCUI.`);
    return null; 
  }

  try {
    const response = await axios.get<GetAllPropertiesResponse>(
      `${RXNORM_API_BASE_URL}/rxcui/${rxcui}/allProperties.json`,
      {
        params: {
          prop: 'all',
        },
      }
    );

    if (response.data?.propConceptGroup?.propConcept?.length > 0) {
      const propertiesArray: PropertyNameValuePair[] = response.data.propConceptGroup.propConcept;
      const processedProps: Partial<ProcessedDrugProperties> = {
        rxcui: rxcui,
        rawProperties: propertiesArray,
        synonyms: [],
        ingredients: [],
        dosageForms: [],
        ndcs: [],
        strengths: [],
        brandNames: [],
      };

      let nameFromApi: string | undefined;
      let ttyFromApi: string | undefined;

      propertiesArray.forEach(prop => {
        const propNameUpper = prop.propName.toUpperCase();
        switch (propNameUpper) {
          case 'RXNORM NAME':
          case 'PRESCRIBABLE NAME':
            if (!nameFromApi) nameFromApi = prop.propValue;
            break;
          case 'TTY':
            ttyFromApi = prop.propValue;
            break;
          case 'SYN':
            processedProps.synonyms?.push(prop.propValue);
            break;
          case 'NDC':
            processedProps.ndcs?.push(prop.propValue);
            break;
          case 'INGREDIENT':
          case 'ACTIVE_INGREDIENTS':
            if (prop.propValue && !processedProps.ingredients?.includes(prop.propValue)) {
              processedProps.ingredients?.push(prop.propValue);
            }
            break;
          case 'DOSAGE FORM':
          case 'DOSAGEFORM':
          case 'ADMINISTERED_DOSAGE_FORM':
            if (prop.propValue && !processedProps.dosageForms?.includes(prop.propValue)) {
              processedProps.dosageForms?.push(prop.propValue);
            }
            break;
          case 'STRENGTH':
          case 'AVAILABLE_STRENGTH':
          case 'INGREDIENT_AND_STRENGTH':
            if (prop.propValue && !processedProps.strengths?.includes(prop.propValue)) {
              processedProps.strengths?.push(prop.propValue);
            }
            break;
          case 'BRAND NAME':
          case 'BRAND_NAME':
            if (prop.propValue && !processedProps.brandNames?.includes(prop.propValue)) {
              processedProps.brandNames?.push(prop.propValue);
            }
            break;
          case 'MANUFACTURER':
            processedProps.manufacturer = prop.propValue;
            break;
          case 'DEA_SCHEDULE':
            processedProps.deaSchedule = prop.propValue;
            break;
        }
      });
      
      processedProps.name = nameFromApi || 'N/A'; // Prioritize API name, then fallback
      processedProps.tty = ttyFromApi || 'N/A';   // Prioritize API TTY

      // Clean up empty arrays
      if (processedProps.synonyms?.length === 0) delete processedProps.synonyms;
      if (processedProps.ingredients?.length === 0) delete processedProps.ingredients;
      if (processedProps.dosageForms?.length === 0) delete processedProps.dosageForms;
      if (processedProps.ndcs?.length === 0) delete processedProps.ndcs;
      if (processedProps.strengths?.length === 0) delete processedProps.strengths;
      if (processedProps.brandNames?.length === 0) delete processedProps.brandNames;
      
      // console.log("[medicineService] Processed Drug Details:", JSON.stringify(processedProps, null, 2));
      return processedProps as ProcessedDrugProperties;

    } else {
      // API returned successfully but no properties found for this rxcui
      // This is a "Not Found" scenario from the perspective of finding drug details.
      console.log(`[medicineService] No properties found for RxCUI ${rxcui}.`);
      throw new NotFoundError('Drug details', `No details found for RxCUI: ${rxcui}.`, { rxcui });
      // Returning null was the previous behavior, but throwing NotFoundError is more explicit.
      // If the calling code expects null for "not found", this is a breaking change.
      // Consider if null or NotFoundError is more appropriate for your UI flow.
      // For now, throwing NotFoundError to be explicit.
      // return null; 
    }
  } catch (error) {
    // If it's already an AppError (like the NotFoundError thrown above), rethrow it.
    // Otherwise, process it with handleError.
    if (error instanceof AppError) {
      throw error;
    }
    console.error(`Error fetching details for RxCUI ${rxcui}:`, error);
    throw handleError(error, `fetching details for drug RxCUI "${rxcui}"`);
  }
};

// --- New Function for Approximate Search ---

// Interface for the response from /approximateTerm.json
interface ApproximateTermResponse {
  approximateGroup: {
    inputTerm: string;
    maxEntries: string;
    comment?: string;
    candidate: {
      rxcui: string;
      rxaui: string;
      score: string; // Score indicating match quality
      rank: string;
    }[];
  };
}

// Interface for the response from /property.json
interface PropertyResponse {
  propConceptGroup: {
    propConcept: {
        propCategory: string;
        propName: string;
        propValue: string;
    }[];
  } | null; // Can be null if property doesn't exist
}

const MAX_APPROXIMATE_RESULTS_TO_FETCH_NAMES = 8; // Limit secondary API calls

/**
 * Searches for drugs using approximate matching and fetches names for top results.
 * @param {string} query The partial drug name to search for.
 * @returns {Promise<DrugConcept[]>} A promise that resolves to an array of drug concepts (name + rxcui).
 */
export const searchDrugsApproximate = async (query: string): Promise<DrugConcept[]> => {
  if (!query || query.trim().length < 3) {
    console.warn('[medicineService] Approximate drug search query too short, returning empty.');
    return [];
  }

  try {
    const approxResponse = await axios.get<ApproximateTermResponse>(
      `${RXNORM_API_BASE_URL}/approximateTerm.json`,
      {
        params: {
          term: query.trim(),
          maxEntries: MAX_APPROXIMATE_RESULTS_TO_FETCH_NAMES * 2, // Fetch more initially
          option: 0, // Standard search
        },
      }
    );

    if (
      !approxResponse.data?.approximateGroup?.candidate ||
      approxResponse.data.approximateGroup.candidate.length === 0
    ) {
      console.log(`[medicineService] No approximate candidates found for query: "${query}"`);
      // Optional: throw new NoResultsError(query, `No approximate drug matches found for "${query}".`);
      return [];
    }

    // Sort candidates by score (descending) and rank (ascending if scores are equal)
    const sortedCandidates = approxResponse.data.approximateGroup.candidate
      .map(c => ({ ...c, score: parseFloat(c.score), rank: parseInt(c.rank, 10) }))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.rank - b.rank;
      });
    
    const topCandidates = sortedCandidates.slice(0, MAX_APPROXIMATE_RESULTS_TO_FETCH_NAMES);

    const drugConcepts: DrugConcept[] = [];

    // Sequentially fetch names to avoid overwhelming the API
    // Consider Promise.allSettled for parallel fetching with error handling per item if performance is critical
    for (const candidate of topCandidates) {
      try {
        const nameResponse = await axios.get<PropertyResponse>(
          `${RXNORM_API_BASE_URL}/rxcui/${candidate.rxcui}/property.json`,
          { params: { propName: 'RxNorm Name' } }
        );

        let drugName = 'Name not found'; // Default name
        if (nameResponse.data?.propConceptGroup?.propConcept?.[0]?.propValue) {
          drugName = nameResponse.data.propConceptGroup.propConcept[0].propValue;
        } else {
            // Attempt to get prescribable name if RxNorm Name is not found
            const prescribableNameResponse = await axios.get<PropertyResponse>(
              `${RXNORM_API_BASE_URL}/rxcui/${candidate.rxcui}/property.json`,
              { params: { propName: 'Prescribable Name' } }
            );
            if (prescribableNameResponse.data?.propConceptGroup?.propConcept?.[0]?.propValue) {
              drugName = prescribableNameResponse.data.propConceptGroup.propConcept[0].propValue;
            }
        }
        
        // Add a basic TTY. For approximate search, this might be less critical or harder to get accurately without more calls.
        // For now, we'll add a placeholder or try to infer if possible.
        // Since we don't have TTY directly from this flow, we might omit it or set a default.
        // To keep the DrugConcept interface, we'll add a placeholder.
        drugConcepts.push({
          rxcui: candidate.rxcui,
          name: drugName,
          tty: 'APPROX', // Indicate it's from an approximate search
          synonym: '', // Not available from this specific call sequence
          language: 'EN', // Assuming English
          suppress: 'N',  // Assuming not suppressed
          umlscui: '',    // Not available
        });

      } catch (nameFetchError) {
        // Log error for individual name fetch but don't let it stop the whole process
        console.error(`[medicineService] Error fetching name for rxcui ${candidate.rxcui} during approximate search:`, nameFetchError);
        // Optionally add a placeholder with an error indicator or skip this candidate
         drugConcepts.push({
          rxcui: candidate.rxcui,
          name: 'Error fetching name',
          tty: 'ERROR',
          synonym: '', language: 'EN', suppress: 'N', umlscui: '',
        });
      }
    }
    
    if (drugConcepts.length === 0 && topCandidates.length > 0) {
        // This means we had candidates but failed to fetch names for all of them
        console.warn(`[medicineService] Had ${topCandidates.length} candidates for "${query}" but failed to fetch any names.`);
        // Depending on requirements, could throw an error here or return empty.
        // throw handleError(new Error("Failed to resolve names for approximate matches."), `resolving drug names for "${query}"`);
    } else if (drugConcepts.length === 0) {
      console.log(`[medicineService] No drug concepts could be formed from approximate search for: "${query}"`);
      // Optional: throw new NoResultsError(query, `No drugs found matching "${query}" (approximate).`);
    }


    return drugConcepts;
  } catch (error) {
    console.error(`Error during approximate drug search for "${query}":`, error);
    throw handleError(error, `searching (approximate) for drugs related to "${query}"`);
  }
};

// Example: getDrugDetailsByRxcui(rxcui: string) 