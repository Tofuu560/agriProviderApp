import {Platform} from 'react-native';
import Constants from 'expo-constants';
import {request} from './api';
export async function enablePushNotifications(){
 if(Platform.OS==='web')throw new Error('Use the Android or iPhone app for push notifications. Your in-app notifications are available here.');
 const projectId=Constants.expoConfig?.extra?.eas?.projectId;
 if(!projectId)throw new Error('Push notifications require an Expo project and a development build. In-app notifications are available now.');
 const Notifications=await import('expo-notifications');
 if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('default',{name:'AgriProvider',importance:Notifications.AndroidImportance.DEFAULT});
 let permission=await Notifications.getPermissionsAsync();if(permission.status!=='granted')permission=await Notifications.requestPermissionsAsync();
 if(permission.status!=='granted')throw new Error('Notification permission was not granted.');
 const result=await Notifications.getExpoPushTokenAsync({projectId});await request('/me/push-token',{token:result.data});
}
