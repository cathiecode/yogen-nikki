import {
  MemoryPostRepository,
  AddNewPostUsecaseInteractor,
  PostService,
  CreateAccountUsecaseInteractor,
  UserService,
  MemoryUserRepository,
  User,
} from "./index";

test("MemoryUserRepositoryからユーザーを取得できる", async () => {
  const repository = new MemoryUserRepository();
  await repository.create(
    new User({
      id: "test_user",
      personalityClass: { outdoor: false, extrovert: false },
    })
  );
  expect((await repository.findById("test_user"))?.getId()).toBe("test_user");
});

test("CreateAccountUsecaseInteractorでユーザーを作成できる", async () => {
  const repository = new MemoryUserRepository();
  const usecaseInteractor = new CreateAccountUsecaseInteractor(
    UserService.getInstace(),
    repository
  );

  const user = await usecaseInteractor.handle({
    personalityClass: { outdoor: false, extrovert: false },
  });

  expect((await repository.findById(user.id))?.getId()).toBe(user.id);
});

test("AddNewPostUsecaseInteractorで投稿を作成できる", async () => {
  const userRepository = new MemoryUserRepository();
  userRepository.create(
    new User({
      id: "test_user",
      personalityClass: { outdoor: false, extrovert: false },
    })
  );
  const postRepository = new MemoryPostRepository();
  const usecaseInteractor = new AddNewPostUsecaseInteractor(
    PostService.getInstace(),
    userRepository,
    postRepository
  );

  await usecaseInteractor.handle({
    userId: "test_user",
  });
});
