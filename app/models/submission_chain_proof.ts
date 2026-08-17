import { SubmissionChainProofSchema } from '#database/schema'

export type SubmissionChainProofStatus =
  | 'pending'
  | 'attested'
  | 'scored'
  | 'partial'
  | 'failed'

export default class SubmissionChainProof extends SubmissionChainProofSchema {}
