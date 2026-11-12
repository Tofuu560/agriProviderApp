import React from 'react';
import {router} from 'expo-router';
import {AuthShell} from '../../components/AuthShell';
import {Banner,Body,Button} from '../../components/ui';
export default function Pending(){return <AuthShell title="Awaiting Administrator Approval" subtitle="Your application has been received."><Banner>Your account is pending review.</Banner><Body>You cannot access a workspace until an administrator approves your account. After approval, sign in with the email and password you chose.</Body><Body muted>If you need help with your application, contact your platform administrator.</Body><Button title="Back to sign in" onPress={()=>router.replace('/(auth)/login')}/></AuthShell>;}
