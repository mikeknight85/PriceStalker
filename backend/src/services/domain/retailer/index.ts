import { RetailerQueryService } from './RetailerQueryService';
import { RetailerMutationService } from './RetailerMutationService';
import { RetailerTestingService } from './RetailerTestingService';
import { aiSelectorService, AISelectorService } from './AISelectorService';

const queryService = new RetailerQueryService();
const mutationService = new RetailerMutationService(queryService);
const testingService = new RetailerTestingService();

export const retailerService = {
  // Query
  getAllRetailers: queryService.getAllRetailers.bind(queryService),
  getRetailerByDomain: queryService.getRetailerByDomain.bind(queryService),
  getRetailerForUrl: queryService.getRetailerForUrl.bind(queryService),
  getAISelectorsForDomain: aiSelectorService.getAISelectorsForDomain.bind(aiSelectorService),

  // Mutation
  upsertRetailer: mutationService.upsertRetailer.bind(mutationService),
  deleteRetailer: mutationService.deleteRetailer.bind(mutationService),

  // Testing
  testRetailerConfig: testingService.testRetailerConfig.bind(testingService)
};

export {
  RetailerQueryService,
  RetailerMutationService,
  RetailerTestingService,
  AISelectorService
};
