import { Redirect } from 'expo-router';

// Root index redirects to the scan tab inside the (tabs) group.
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
