"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, Input, VStack, Heading, Text, HStack } from '@chakra-ui/react';
import { signIn, signUp, signInWithGoogle } from '@/lib/firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  // ログイン済みの場合はダッシュボードにリダイレクト
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleEmailAuth = async () => {
    setLoading(true);
    setError('');

    try {
      const result = isSignUp
        ? await signUp(email, password)
        : await signIn(email, password);

      if (result.error) {
        setError(result.error);
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await signInWithGoogle();
      if (result.error) {
        setError(result.error);
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="gray.50"
      p={4}
    >
      <Box
        maxW="md"
        w="full"
        bg="white"
        p={8}
        borderRadius="lg"
        boxShadow="lg"
      >
        <VStack gap={6}>
          <Heading size="xl">TimeTurn</Heading>
          <Text color="gray.600">
            {isSignUp ? 'アカウントを作成' : 'ログイン'}
          </Text>

          <VStack gap={4} w="full">
            <Input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              size="lg"
            />
            <Input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              size="lg"
            />

            {error && (
              <Text color="red.500" fontSize="sm">
                {error}
              </Text>
            )}

            <Button
              w="full"
              colorScheme="blue"
              size="lg"
              onClick={handleEmailAuth}
              loading={loading}
            >
              {isSignUp ? '登録' : 'ログイン'}
            </Button>

            <Button
              w="full"
              variant="outline"
              size="lg"
              onClick={handleGoogleAuth}
              loading={loading}
            >
              Googleでログイン
            </Button>
          </VStack>

          <HStack>
            <Text fontSize="sm" color="gray.600">
              {isSignUp ? 'アカウントをお持ちですか？' : 'アカウントをお持ちでないですか？'}
            </Text>
            <Button
              variant="link"
              colorScheme="blue"
              size="sm"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'ログイン' : '登録'}
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
}
