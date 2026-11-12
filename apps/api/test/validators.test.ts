import { describe,it,expect } from 'vitest';import { validSaId,learnerSchema,passwordForUser } from '@agri/shared';
const valid='9001015000085';
describe('South African ID and registration validation',()=>{
 it('accepts a checksum-valid synthetic ID',()=>expect(validSaId(valid)).toBe(true));
 it.each(['900101500008','90010150000899','900101ABCDE89','9002315000089','9001015000080','9001015000289',' 9001015000089','900101-5000089'])('rejects %s',v=>expect(validSaId(v)).toBe(false));
 it('rejects missing consent and phone letters',()=>expect(learnerSchema.safeParse({cohortId:'11111111-1111-4111-8111-111111111111',fullName:'Test Learner',nationalId:valid,phone:'+27letters',consent:false,clientOpId:'22222222-2222-4222-8222-222222222222'}).success).toBe(false));
 it('rejects passwords containing account identity',()=>expect(passwordForUser('Thandi!Secure123','thandi@example.test','Thandi Dlamini')).toBe(false));
});