const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError(null);

  try {
    if (isSignUp) {
      const { data: codeData, error: codeErr } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', inviteCode.trim().toUpperCase())
        .eq('is_active', true)
        .single();

      if (codeErr || !codeData) {
        throw new Error('Invalid or inactive invite code.');
      }

      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            team_name: teamName,
          },
        },
      });

      if (signUpErr) throw signUpErr;
    } else {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInErr) throw signInErr;
    }

    onSuccess();
  } catch (err: any) {
    console.error('Auth Error:', err);
    setError(err.message || 'Authentication failed. Check network or credentials.');
  } finally {
    setLoading(false); // Reset loading state
  }
};
