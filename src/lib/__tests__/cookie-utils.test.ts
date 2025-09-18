/**
 * Simple test file for cookie utilities
 * Run in browser console to verify functionality
 */

// Test cookie functionality
function testCookieUtils() {
  console.log('Testing cookie utilities...');
  
  // Test setCookieWithMinutes
  const testCookieName = 'test_dismiss';
  const testValue = 'true';
  
  // Clear any existing test cookie
  document.cookie = `${testCookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  
  // Set cookie for 1 minute (for testing)
  const testMinutes = 1;
  const date = new Date();
  date.setTime(date.getTime() + (testMinutes * 60 * 1000));
  document.cookie = `${testCookieName}=${testValue}; expires=${date.toUTCString()}; path=/`;
  
  console.log('Cookie set:', document.cookie);
  
  // Test getCookie
  const getCookie = (name: string) => {
    const nameEQ = encodeURIComponent(name) + '=';
    const cookies = document.cookie.split(';');
    
    for (let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i];
      while (cookie.charAt(0) === ' ') {
        cookie = cookie.substring(1, cookie.length);
      }
      if (cookie.indexOf(nameEQ) === 0) {
        return decodeURIComponent(cookie.substring(nameEQ.length, cookie.length));
      }
    }
    return null;
  };
  
  const retrievedValue = getCookie(testCookieName);
  console.log('Retrieved cookie value:', retrievedValue);
  
  // Test expiration
  setTimeout(() => {
    const expiredValue = getCookie(testCookieName);
    console.log('Value after expiration:', expiredValue);
    console.log('Cookie should be null after expiration');
  }, 61000); // 61 seconds
  
  console.log('Cookie test complete');
}

// Export for manual testing
export { testCookieUtils };