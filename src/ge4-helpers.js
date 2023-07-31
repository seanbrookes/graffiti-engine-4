/**
 * resets the page to 'defaul' new post editor mode
 * 
 * checks url to see if there is an active editing session
 * - if so then prompts for confirmation first
 */
export const clearNew = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const postRef = urlParams.get('post');
  if (postRef && confirm('leave this post?')) {
    document.location.href = './?mode=edit';
  }
  else {
    document.location.href = './?mode=edit';
  }
};