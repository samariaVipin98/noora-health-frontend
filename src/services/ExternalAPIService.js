import { request, gql } from 'graphql-request';

const API_URL = 'https://rickandmortyapi.com/graphql';

export const GET_LOCATIONS_WITH_RESIDENTS = gql`
  query GetLocations($page: Int) {
    locations(page: $page) {
      info {
        pages
        next
      }
      results {
        id
        name
        type
        residents {
          id
          name
          status
          species
          image
        }
      }
    }
  }
`;

export const fetchLocations = (page = 1) => 
  request(API_URL, GET_LOCATIONS_WITH_RESIDENTS, { page });