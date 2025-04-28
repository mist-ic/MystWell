import axios from 'axios';

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
    // Avoid sending requests for very short or empty strings
    return [];
  }

  try {
    const response = await axios.get<GetDrugsResponse>(`${RXNORM_API_BASE_URL}/drugs.json`, {
      params: {
        name: drugName.trim(),
      },
    });

    // Extract the conceptProperties from the nested structure
    const concepts: DrugConcept[] = [];
    if (response.data?.drugGroup?.conceptGroup) {
      response.data.drugGroup.conceptGroup.forEach(group => {
        if (group.conceptProperties) {
          concepts.push(...group.conceptProperties);
        }
      });
    }

    // Optionally filter or prioritize results based on TTY (Term Type) if needed
    // e.g., prioritize Ingredients ('IN') or Brand Names ('BN')

    return concepts;
  } catch (error) {
    console.error('Error searching RxNorm drugs:', error);
    // Consider more robust error handling (e.g., returning a specific error object)
    throw new Error('Failed to fetch drugs from RxNorm API.');
  }
};

/**
 * Fetches detailed properties for a specific drug using its RxCUI.
 * @param {string} rxcui The RxNorm Concept Unique Identifier.
 * @returns {Promise<ProcessedDrugProperties | null>} A promise that resolves to the processed drug properties or null if not found.
 */
export const getDrugDetailsByRxcui = async (rxcui: string): Promise<ProcessedDrugProperties | null> => {
  if (!rxcui) {
    return null;
  }

  try {
    const response = await axios.get<GetAllPropertiesResponse>(
      `${RXNORM_API_BASE_URL}/rxcui/${rxcui}/allProperties.json`,
      {
        params: {
          prop: 'all', // Request all properties
        },
      }
    );

    // The API returns properties nested within propConceptGroup.propConcept
    if (response.data?.propConceptGroup?.propConcept?.length > 0) {
      const propertiesArray: PropertyNameValuePair[] = response.data.propConceptGroup.propConcept;

      // --- Process the propertiesArray into a structured object --- 
      const processedProps: Partial<ProcessedDrugProperties> = {
        rxcui: rxcui,
        rawProperties: propertiesArray,
        synonyms: [],
        ingredients: [],
        dosageForms: [],
        ndcs: [],
        strengths: [], // Initialize new fields
        brandNames: [], // Initialize new fields
      };

      propertiesArray.forEach(prop => {
        // Standardize propName check (e.g., uppercase) for robustness if needed
        const propNameUpper = prop.propName.toUpperCase(); // Use uppercase for comparison

        switch (propNameUpper) { // Switch on uppercase name
          case 'RXNORM NAME':
          case 'PRESCRIBABLE NAME': 
            if (!processedProps.name) processedProps.name = prop.propValue;
            break;
          case 'TTY': 
            processedProps.tty = prop.propValue; 
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
          case 'BRAND_NAME': // Handle case variation
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
          // Add more cases here for other properties
        }
      });

      // Ensure required fields have fallbacks (TTY should be assigned now)
      processedProps.name = processedProps.name || 'N/A';
      processedProps.tty = processedProps.tty || 'N/A'; // Keep fallback just in case

      // Clean up empty arrays (optional)
      if (processedProps.synonyms?.length === 0) delete processedProps.synonyms;
      if (processedProps.ingredients?.length === 0) delete processedProps.ingredients;
      if (processedProps.dosageForms?.length === 0) delete processedProps.dosageForms;
      if (processedProps.ndcs?.length === 0) delete processedProps.ndcs;
      if (processedProps.strengths?.length === 0) delete processedProps.strengths;
      if (processedProps.brandNames?.length === 0) delete processedProps.brandNames;

      // *** Add console log here ***
      console.log("[medicineService] Processed Drug Details:", JSON.stringify(processedProps, null, 2));

      return processedProps as ProcessedDrugProperties;

    } else {
      return null; // No properties found
    }
  } catch (error) {
    console.error(`Error fetching details for RxCUI ${rxcui}:`, error);
    // Handle specific error types (e.g., 404 Not Found) if needed
    throw new Error('Failed to fetch drug details from RxNorm API.');
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
    return [];
  }

  try {
    // Step 1: Get approximate matches (RxCUIs and scores)
    const approxResponse = await axios.get<ApproximateTermResponse>(
      `${RXNORM_API_BASE_URL}/approximateTerm.json`,
      {
        params: {
          term: query.trim(),
          maxEntries: MAX_APPROXIMATE_RESULTS_TO_FETCH_NAMES + 5, 
          option: 1 // Option 1 includes stemmed results, might be useful? Test if needed.
        },
      }
    );

    if (!approxResponse.data?.approximateGroup?.candidate?.length) {
      return []; // No approximate matches found
    }

    // Sort candidates by score (descending, higher score is better) and take the top N
    // Score is a string, convert to number for sorting
    const topCandidates = approxResponse.data.approximateGroup.candidate
      .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
      .slice(0, MAX_APPROXIMATE_RESULTS_TO_FETCH_NAMES);

    // Step 2: Fetch the name for each top candidate RxCUI
    const drugConcepts: DrugConcept[] = [];
    
    // Use Promise.allSettled to fetch names concurrently and handle individual errors
    const nameFetchPromises = topCandidates.map(async (candidate) => {
      try {
        const propResponse = await axios.get<PropertyResponse>(
          `${RXNORM_API_BASE_URL}/rxcui/${candidate.rxcui}/property.json`,
          {
            params: { propName: 'RxNorm Name' },
          }
        );

        const name = propResponse.data?.propConceptGroup?.propConcept?.[0]?.propValue;
        
        if (name) {
          // Construct a DrugConcept-like object (filling only essential fields)
          return {
            rxcui: candidate.rxcui,
            name: name,
            tty: '', // We don't get TTY from this flow easily
            synonym: '', language: '', suppress: '', umlscui: '' // Fill blanks
          } as DrugConcept;
        } else {
           console.warn(`No RxNorm Name found for RxCUI: ${candidate.rxcui}`);
           return null; // Indicate failure to fetch name for this candidate
        }
      } catch (nameError) {
        console.error(`Error fetching name for RxCUI ${candidate.rxcui}:`, nameError);
        return null; // Indicate failure
      }
    });

    const results = await Promise.allSettled(nameFetchPromises);

    // Filter out nulls (failures) and extract successful results
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        drugConcepts.push(result.value);
      }
    });

    return drugConcepts;

  } catch (error) {
    console.error('Error during approximate drug search:', error);
    // Distinguish between network errors and no-results scenarios if needed
    throw new Error('Failed to perform approximate drug search.');
  }
};

// Example: getDrugDetailsByRxcui(rxcui: string) 