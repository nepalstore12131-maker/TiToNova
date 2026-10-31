'use client';
import {useEffect} from 'react';
export function NotificationSync({stamp}:{stamp:string}){useEffect(()=>{window.dispatchEvent(new Event('titonova:notifications-read'));},[stamp]);return null;}
